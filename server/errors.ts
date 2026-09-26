/** 统一 API 错误（docs/03 第 8 节）：响应中不出现磁盘路径、堆栈或文件内容。 */

import type { ApiError } from '../src/shared/contracts.ts';

export class ApiFailure extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields?: { path: string; message: string }[];

  constructor(status: number, code: string, message: string, fields?: { path: string; message: string }[]) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }

  toBody(): ApiError {
    return { error: { code: this.code, message: this.message, ...(this.fields ? { fields: this.fields } : {}) } };
  }
}
