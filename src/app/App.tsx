import CampusPage from './CampusPage';
import FullMapPage from './FullMapPage';
import MapPage from './MapPage';
import PlacePage from './PlacePage';
import StartScreen from './StartScreen';
import { useRoute } from './router';

export default function App() {
  const { route, navigate, back } = useRoute();
  switch (route.name) {
    case 'start':
      return <StartScreen onNavigate={navigate} />;
    case 'map':
      return <MapPage onNavigate={navigate} onBack={() => back({ name: 'start' })} />;
    case 'full-map':
      return <FullMapPage onNavigate={navigate} onBack={() => back({ name: 'start' })} />;
    case 'campus':
      return <CampusPage key={route.campusId} campusId={route.campusId} onNavigate={navigate} onBack={() => back({ name: 'start' })} />;
    case 'place':
      return <PlacePage key={route.placeId} placeId={route.placeId} onNavigate={navigate} onBack={() => back({ name: 'campus', campusId: 'xiaoxiang' })} />;
  }
}
