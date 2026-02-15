/**
 * 文件系统 tRPC 路由
 */

import {
  BatchConfirmUploadInputSchema,
  BatchConfirmUploadOutputSchema,
  BatchPrepareUploadInputSchema,
  BatchPrepareUploadOutputSchema,
  ConfirmUploadInputSchema,
  CreateFolderInputSchema,
  DeleteFileInputSchema,
  EnsureFolderPathInputSchema,
  EnsureFolderPathOutputSchema,
  FileNodeSchema,
  GetDownloadUrlInputSchema,
  GetDownloadUrlOutputSchema,
  GetFilePathInputSchema,
  GetFilePathOutputSchema,
  GetUploadUrlInputSchema,
  GetUploadUrlOutputSchema,
  ListFilesInputSchema,
  MoveFileInputSchema,
  PrepareUploadInputSchema,
  PrepareUploadOutputSchema,
  RenameFileInputSchema,
} from "@miu2d/types";
import { z } from "zod";
import type { Context } from "../../trpc/context";
import { Ctx, Mutation, Query, Router, UseMiddlewares } from "../../trpc/decorators";
import { requireUser } from "../../trpc/middlewares";
import { Logger } from "../../utils/logger.js";
import { fileService } from "./file.service";

@Router({ alias: "file" })
export class FileRouter {
  private readonly logger = new Logger(FileRouter.name);

  constructor() {
    this.logger.log("FileRouter registered");
  }

  /**
   * 列出目录内容
   */
  @UseMiddlewares(requireUser)
  @Query({ input: ListFilesInputSchema, output: z.array(FileNodeSchema) })
  async list(input: z.infer<typeof ListFilesInputSchema>, @Ctx() ctx: Context) {
    return fileService.listFiles(input.gameId, input.parentId, ctx.userId!, ctx.language);
  }

  /**
   * 获取文件信息
   */
  @UseMiddlewares(requireUser)
  @Query({
    input: z.object({ fileId: z.string().uuid() }),
    output: FileNodeSchema,
  })
  async get(input: { fileId: string }, @Ctx() ctx: Context) {
    return fileService.getFile(input.fileId, ctx.userId!, ctx.language);
  }

  /**
   * 获取文件路径
   */
  @UseMiddlewares(requireUser)
  @Query({ input: GetFilePathInputSchema, output: GetFilePathOutputSchema })
  async getPath(input: z.infer<typeof GetFilePathInputSchema>, @Ctx() ctx: Context) {
    return fileService.getFilePath(input.fileId, ctx.userId!, ctx.language);
  }

  /**
   * 创建目录
   */
  @UseMiddlewares(requireUser)
  @Mutation({ input: CreateFolderInputSchema, output: FileNodeSchema })
  async createFolder(input: z.infer<typeof CreateFolderInputSchema>, @Ctx() ctx: Context) {
    return fileService.createFolder(
      input.gameId,
      input.parentId,
      input.name,
      ctx.userId!,
      ctx.language
    );
  }

  /**
   * 准备上传（获取预签名 URL）
   */
  @UseMiddlewares(requireUser)
  @Mutation({ input: PrepareUploadInputSchema, output: PrepareUploadOutputSchema })
  async prepareUpload(input: z.infer<typeof PrepareUploadInputSchema>, @Ctx() ctx: Context) {
    return fileService.prepareUpload(
      input.gameId,
      input.parentId,
      input.name,
      input.size,
      input.mimeType,
      ctx.userId!,
      ctx.language
    );
  }

  /**
   * 确认上传完成
   */
  @UseMiddlewares(requireUser)
  @Mutation({ input: ConfirmUploadInputSchema, output: FileNodeSchema })
  async confirmUpload(input: z.infer<typeof ConfirmUploadInputSchema>, @Ctx() ctx: Context) {
    return fileService.confirmUpload(input.fileId, ctx.userId!, ctx.language);
  }

  /**
   * 获取下载 URL（使用 Mutation 以便前端可以即时调用）
   */
  @UseMiddlewares(requireUser)
  @Mutation({ input: GetDownloadUrlInputSchema, output: GetDownloadUrlOutputSchema })
  async getDownloadUrl(input: z.infer<typeof GetDownloadUrlInputSchema>, @Ctx() ctx: Context) {
    const downloadUrl = await fileService.getDownloadUrl(input.fileId, ctx.userId!, ctx.language);
    return { downloadUrl };
  }

  /**
   * 获取上传 URL（用于更新现有文件内容）
   */
  @UseMiddlewares(requireUser)
  @Mutation({ input: GetUploadUrlInputSchema, output: GetUploadUrlOutputSchema })
  async getUploadUrl(input: z.infer<typeof GetUploadUrlInputSchema>, @Ctx() ctx: Context) {
    return fileService.getUploadUrl(
      input.fileId,
      input.size,
      input.mimeType,
      ctx.userId!,
      ctx.language
    );
  }

  /**
   * 重命名文件/目录
   */
  @UseMiddlewares(requireUser)
  @Mutation({ input: RenameFileInputSchema, output: FileNodeSchema })
  async rename(input: z.infer<typeof RenameFileInputSchema>, @Ctx() ctx: Context) {
    return fileService.rename(input.fileId, input.newName, ctx.userId!, ctx.language);
  }

  /**
   * 移动文件/目录
   */
  @UseMiddlewares(requireUser)
  @Mutation({ input: MoveFileInputSchema, output: FileNodeSchema })
  async move(input: z.infer<typeof MoveFileInputSchema>, @Ctx() ctx: Context) {
    return fileService.move(input.fileId, input.newParentId, ctx.userId!, ctx.language);
  }

  /**
   * 删除文件/目录
   */
  @UseMiddlewares(requireUser)
  @Mutation({
    input: DeleteFileInputSchema,
    output: z.object({ id: z.string().uuid() }),
  })
  async delete(input: z.infer<typeof DeleteFileInputSchema>, @Ctx() ctx: Context) {
    return fileService.delete(input.fileId, ctx.userId!, ctx.language);
  }

  /**
   * 批量准备上传（获取预签名 URL）
   * 一次处理最多 200 个文件，减少网络往返
   */
  @UseMiddlewares(requireUser)
  @Mutation({ input: BatchPrepareUploadInputSchema, output: BatchPrepareUploadOutputSchema })
  async batchPrepareUpload(
    input: z.infer<typeof BatchPrepareUploadInputSchema>,
    @Ctx() ctx: Context
  ) {
    const results = await fileService.batchPrepareUpload(
      input.gameId,
      input.files.map((f) => ({
        clientId: f.clientId,
        parentId: f.parentId ?? null,
        name: f.name,
        size: f.size,
        mimeType: f.mimeType,
      })),
      input.skipExisting ?? false,
      ctx.userId!,
      ctx.language
    );
    return { results };
  }

  /**
   * 批量确认上传完成
   */
  @UseMiddlewares(requireUser)
  @Mutation({ input: BatchConfirmUploadInputSchema, output: BatchConfirmUploadOutputSchema })
  async batchConfirmUpload(
    input: z.infer<typeof BatchConfirmUploadInputSchema>,
    @Ctx() ctx: Context
  ) {
    const confirmed = await fileService.batchConfirmUpload(
      input.fileIds,
      ctx.userId!,
      ctx.language
    );
    return { confirmed };
  }

  /**
   * 服务端创建文件夹路径
   */
  @UseMiddlewares(requireUser)
  @Mutation({ input: EnsureFolderPathInputSchema, output: EnsureFolderPathOutputSchema })
  async ensureFolderPath(input: z.infer<typeof EnsureFolderPathInputSchema>, @Ctx() ctx: Context) {
    const folderId = await fileService.ensureFolderPath(
      input.gameId,
      input.parentId ?? null,
      input.pathParts,
      ctx.userId!,
      ctx.language
    );
    return { folderId };
  }
}
