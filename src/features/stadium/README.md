# C：体育场（副场）+ 内容编辑器（MVP）

负责地点功能页 `StadiumPanel`（社团 + 活动查询）与本地可视化内容编辑器 `ContentEditor`。
当前为 **MVP**，按冻结契约 1.0.0 独立开发，使用 mock API；接 A 宿主 / D 真实服务后替换。

## 文件清单

| 文件 | 说明 |
|---|---|
| `src/features/stadium/types.ts` | 契约类型本地副本（临时，待 A 落地 shared/contracts.ts 后改 import） |
| `src/features/stadium/domain.ts` | 纯逻辑：筛选、状态、时间、校验、导入导出（无副作用，可单测） |
| `src/features/stadium/StadiumPanel.tsx` | 地点查询页：社团目录 / 活动查询 / 相册占位 |
| `src/features/stadium/stadium.css` | 查询页样式（临时） |
| `src/features/content-editor/ContentEditor.tsx` | 内容编辑器：CRUD、导入导出、revision 冲突处理 |
| `src/features/content-editor/editor.css` | 编辑器样式（临时） |
| `src/features/content-editor/mockPublicContentApi.ts` | 内存版 PublicContentApi（开发/测试替身） |
| `src/features/stadium/preview/` | 开发预览宿主（临时，接入 A 宿主后删除） |
| `stadium-preview.html` | 预览入口（临时） |
| `tests/unit/stadium/domain.test.ts` | 领域逻辑单测 |
| `tests/unit/content-editor/mock-api.test.ts` | mock API 单测 |

## 运行

```bash
npm run dev
# 打开 http://127.0.0.1:5173/stadium-preview.html
```

## 测试

```bash
npm test   # 跑 tests/unit 下的全部单测
```

## 临时与待接入

- **mock API**：`createMockPublicContentApi`，D 交付真实客户端后替换（调用方代码不变）。
- **相册占位**：`StadiumPanel` 的相册标签页是占位，待 D 的 `PlaceGallery`。
- **预览宿主**：`stadium-preview.html` + `preview/` 是临时入口，A 落地 Panel 宿主后删除。
- **类型副本**：`types.ts` 是 `docs/contracts/campus-v1.d.ts` 的副本，A 落地后改从 `src/shared/contracts.ts` import。
- **演示数据**：`preview/sample-data.ts` 全部为占位示例，非真实校园信息。
- **时区**：展示/筛选固定 Asia/Shanghai；编辑表单的 `datetime-local` 暂用浏览器本地时区，接入真实数据时按契约复核。

## 未实现（后续）

- 真实社团/活动内容（待核验）。
- 相册真实上传（依赖 D）。
- 完整的三方合并 UI（冲突时当前只提供「重新加载 / 放弃草稿」）。
