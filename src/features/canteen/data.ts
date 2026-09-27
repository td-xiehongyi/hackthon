export interface CanteenReview {
  id: string;
  author: string;
  rating: number;
  text: string;
}

export interface PublishedCanteenReview extends CanteenReview {
  windowId: string;
  createdAt: string;
}

export type SubmitCanteenReview = Omit<PublishedCanteenReview, 'createdAt'>;

export interface CanteenWindow {
  id: string;
  name: string;
  image: string;
  specialty: string;
  reviews: readonly CanteenReview[];
}

export interface CanteenFloor {
  level: number;
  subtitle: string;
  windows: readonly CanteenWindow[];
}

// 演示目录：名称、楼层分布、插画与评价均非实地采集。
// 正式资料到位后按窗口替换，id 保持稳定；没有评价时使用空数组。
export const CANTEEN_FLOORS: readonly CanteenFloor[] = [
  { level: 1, subtitle: '一日三餐，从这里开始', windows: [
    { id: 'f1-rice', name: '家常小炒', image: '/canteen/f1-rice.svg', specialty: '热菜 · 米饭', reviews: [
      { id: 'rice-1', author: '体验同学 A', rating: 4, text: '青椒肉丝很下饭，想吃清淡一点可以提前说。' },
      { id: 'rice-2', author: '体验同学 B', rating: 5, text: '搭配一荤两素，午饭吃得很满足。' },
    ] },
    { id: 'f1-noodle', name: '热汤米粉', image: '/canteen/f1-noodle.svg', specialty: '米粉 · 汤面', reviews: [
      { id: 'noodle-1', author: '体验同学 C', rating: 4, text: '汤底清爽，喜欢加一点酸豆角。' },
    ] },
  ] },
  { level: 2, subtitle: '换个口味，发现新搭配', windows: [
    { id: 'f2-pot', name: '暖心砂锅', image: '/canteen/f2-pot.svg', specialty: '砂锅 · 炖菜', reviews: [
      { id: 'pot-1', author: '体验同学 D', rating: 5, text: '砂锅端上来还冒着热气，适合慢慢吃。' },
    ] },
    { id: 'f2-mix', name: '自选麻辣烫', image: '/canteen/f2-mix.svg', specialty: '自选配菜 · 汤食', reviews: [
      { id: 'mix-1', author: '体验同学 E', rating: 4, text: '能自己选菜很方便，微辣也挺有味道。' },
      { id: 'mix-2', author: '体验同学 F', rating: 3, text: '喜欢蔬菜搭配，不过饭点可能需要等一会儿。' },
    ] },
  ] },
  { level: 3, subtitle: '热气腾腾的风味一餐', windows: [
    { id: 'f3-sizzle', name: '铁板风味', image: '/canteen/f3-sizzle.svg', specialty: '铁板 · 盖饭', reviews: [
      { id: 'sizzle-1', author: '体验同学 G', rating: 4, text: '酱汁拌饭很香，铁板刚出锅有点烫。' },
    ] },
    { id: 'f3-dumpling', name: '手作水饺', image: '/canteen/f3-dumpling.svg', specialty: '水饺 · 面点', reviews: [
      { id: 'dumpling-1', author: '体验同学 H', rating: 5, text: '饺子配热汤很舒服，希望以后有更多馅料。' },
    ] },
  ] },
  { level: 4, subtitle: '找个位置，慢慢享用', windows: [
    { id: 'f4-light', name: '缤纷轻食', image: '/canteen/f4-light.svg', specialty: '蔬菜 · 轻食饭', reviews: [
      { id: 'light-1', author: '体验同学 I', rating: 4, text: '蔬菜搭配很丰富，酱汁单独放更合口味。' },
    ] },
    { id: 'f4-drink', name: '饮品小站', image: '/canteen/f4-drink.svg', specialty: '饮品 · 休息片刻', reviews: [] },
  ] },
];

export function averageRating(reviews: readonly CanteenReview[]): string | null {
  return reviews.length ? (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1) : null;
}
