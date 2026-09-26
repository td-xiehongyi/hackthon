/**
 * 统一 API 错误对象。所有路由与存储/校验层抛出的业务错误，
 * 都由 Fastify 的错误处理器映射为 `ApiError` JSON 结构：
 * { error: { code, message, fields? } }
 *
 * 注意：本文件使用可擦除语法（无 enum / namespace / 参数属性），
 * 以支持 Node 24 原生运行 TypeScript（类型剥离）。
 */
export class ApiError extends Error {
  status: number;
  code: string;
  fields?: { path: string; message: string }[];

  constructor(
    status: number,
    code: string,
    message: string,
    fields?: { path: string; message: string }[],
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}
