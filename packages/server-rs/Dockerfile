# ===== Stage 1: Build =====
FROM rust:1.90-bookworm AS builder

# Install build dependencies (for OpenSSL via rustls - no system OpenSSL needed)
RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config cmake musl-tools && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Cache dependencies by copying only manifest files first
COPY Cargo.toml Cargo.lock ./
RUN mkdir src && echo 'fn main() {}' > src/main.rs && \
    mkdir -p src/bin && \
    echo 'fn main() {}' > src/bin/migrate.rs && \
    echo 'fn main() {}' > src/bin/seed.rs && \
    echo '' > src/lib.rs && \
    cargo build --release 2>/dev/null || true && \
    rm -rf src

# Copy real source
COPY src/ src/
COPY migrations/ migrations/

# Build the actual binary
RUN cargo build --release --bin server

# ===== Stage 2: Runtime =====
FROM debian:bookworm-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r miu2d && useradd -r -g miu2d -d /app miu2d

WORKDIR /app

# Copy binary and migrations
COPY --from=builder /app/target/release/server /app/server
COPY --from=builder /app/migrations/ /app/migrations/

# Set ownership
RUN chown -R miu2d:miu2d /app

USER miu2d

# Default port
EXPOSE 4000

ENV RUST_LOG=miu2d_server=info,tower_http=info

CMD ["/app/server"]
