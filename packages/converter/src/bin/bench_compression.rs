//! Quick benchmark: compare compression strategies for MPC → MSF
//! Usage: bench_compression <msf_file> <mpc_file>

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 3 {
        eprintln!("Usage: bench_compression <msf_file> <mpc_file>");
        std::process::exit(1);
    }

    let msf = std::fs::read(&args[1]).unwrap();
    let mpc_size = std::fs::metadata(&args[2]).unwrap().len() as usize;

    let frame_count = u16::from_le_bytes([msf[0x0C], msf[0x0D]]) as usize;
    let palette_size = u16::from_le_bytes([msf[0x19], msf[0x1A]]) as usize;
    let ft_start = 0x1C + palette_size * 4;
    let ft_end = ft_start + frame_count * 16;
    let blob_start = ft_end + 8;

    let compressed = &msf[blob_start..];
    let raw_blob = zstd::bulk::decompress(compressed, 100 * 1024 * 1024).unwrap();

    let mut raw_2bpp = Vec::new();
    let mut idx_1bpp = Vec::new();
    let mut alpha_1bpp = Vec::new();
    let mut offset = 0usize;

    for i in 0..frame_count {
        let fe = ft_start + i * 16;
        let w = u16::from_le_bytes([msf[fe + 4], msf[fe + 5]]) as usize;
        let h = u16::from_le_bytes([msf[fe + 6], msf[fe + 7]]) as usize;
        let row_w = w * 2;
        for _ in 0..h {
            offset += 1; // skip filter byte
            let row = &raw_blob[offset..offset + row_w];
            raw_2bpp.extend_from_slice(row);
            for j in (0..row_w).step_by(2) {
                idx_1bpp.push(row[j]);
                alpha_1bpp.push(row[j + 1]);
            }
            offset += row_w;
        }
    }

    let n_ff = alpha_1bpp.iter().filter(|&&a| a == 255).count();
    println!("MPC original:  {:>8} bytes", mpc_size);
    println!(
        "MSF v2 file:   {:>8} bytes ({}% of MPC)",
        msf.len(),
        msf.len() * 100 / mpc_size
    );
    println!("Raw 2bpp:      {:>8} bytes", raw_2bpp.len());
    println!("Idx 1bpp:      {:>8} bytes", idx_1bpp.len());
    println!(
        "Alpha: {}/{} = {}% are 0xFF\n",
        n_ff,
        alpha_1bpp.len(),
        n_ff * 100 / alpha_1bpp.len()
    );

    for level in [3, 9, 19] {
        let c_2bpp = zstd::bulk::compress(&raw_2bpp, level).unwrap();
        let c_filtered = zstd::bulk::compress(&raw_blob, level).unwrap();
        let c_1bpp = zstd::bulk::compress(&idx_1bpp, level).unwrap();
        let mut planes = idx_1bpp.clone();
        planes.extend_from_slice(&alpha_1bpp);
        let c_planes = zstd::bulk::compress(&planes, level).unwrap();

        println!("zstd-{}:", level);
        println!(
            "  raw 2bpp (v1-like):   {:>7} ({}% of MPC)",
            c_2bpp.len(),
            c_2bpp.len() * 100 / mpc_size
        );
        println!(
            "  filtered 2bpp (v2):   {:>7} ({}% of MPC)",
            c_filtered.len(),
            c_filtered.len() * 100 / mpc_size
        );
        println!(
            "  idx 1bpp:             {:>7} ({}% of MPC)",
            c_1bpp.len(),
            c_1bpp.len() * 100 / mpc_size
        );
        println!(
            "  plane-separated 2bpp: {:>7} ({}% of MPC)",
            c_planes.len(),
            c_planes.len() * 100 / mpc_size
        );
    }
}
