import type { PlacePanelProps } from '../../shared/contracts';
import '../library/LibraryPanel.css';
import '../../shared/place-introduction.css';

// 历史资料核对：https://fcglc.csu.edu.cn/info/1035/1213.htm
export default function HepingHallPanel({ place, onRequestClose }: PlacePanelProps) {
  return <section className="library-panel" aria-label={place.name}>
    <header className="library-header">
      <div>
        <span className="library-eyebrow">校园建筑 · HEPING HALL</span>
        <h1>和平楼</h1>
        <p className="library-campus">岳麓山校区</p>
      </div>
      <button type="button" className="library-back" onClick={onRequestClose}>返回校园</button>
    </header>
    <article className="place-introduction">
      <figure className="place-introduction-photo">
        <img src="/places/heping-hall.jpg" alt="和平楼外观" width="704" height="411" />
        <figcaption>岳麓山下，红砖老楼里的校园记忆。</figcaption>
      </figure>
      <h2>地点介绍</h2>
      <p>和平楼位于中南大学岳麓山校区，与民主楼同为校园内保存至今的早期校舍。两座建筑始建于 1936—1937 年，红砖墙面与朴素的楼宇轮廓，留下了老校园的历史印记。</p>
      <h2>一座楼的校园往事</h2>
      <p>和平楼的历史与清华大学在长沙兴建校舍的往事相连。抗战胜利后，长沙的清华校友修缮了这座建筑，并在这里创办清华中学。1952 年中南矿冶学院组建后，和平楼成为新学院校园的一部分，见证了学校的成长与变迁。</p>
      <h2>在这里停留片刻</h2>
      <p>抬头看看红砖、长窗与屋檐，在树荫下感受老建筑的安静。沿楼前走一走，也可以留下一张属于自己的校园照片。</p>
    </article>
  </section>;
}
