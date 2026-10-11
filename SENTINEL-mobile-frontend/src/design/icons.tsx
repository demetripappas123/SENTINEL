import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  CalendarDays,
  Camera,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  Map,
  MapPin,
  Minus,
  Moon,
  Navigation,
  Plus,
  Route,
  ScanLine,
  Search,
  Shield,
  SlidersHorizontal,
  Sun,
  Thermometer,
  TriangleAlert,
  X,
} from "lucide-react-native";

// Same lucide set as the web dashboard, so glyphs match across clients.
const icons = {
  activity: Activity,
  arrow: ArrowRight,
  attention: TriangleAlert,
  calendar: CalendarDays,
  camera: Camera,
  check: Check,
  checks: CheckCheck,
  chevron: ChevronRight,
  close: X,
  down: ChevronDown,
  external: ArrowUpRight,
  facility: Map,
  filters: SlidersHorizontal,
  minus: Minus,
  missions: Route,
  moon: Moon,
  navigation: Navigation,
  pin: MapPin,
  plus: Plus,
  scan: ScanLine,
  search: Search,
  shield: Shield,
  signal: AudioLines,
  sun: Sun,
  temperature: Thermometer,
};
export type IconName = keyof typeof icons;
export function Icon({
  name,
  color,
  size = 20,
}: {
  name: IconName;
  color: string;
  size?: number;
}) {
  const Component = icons[name];
  return (
    <Component size={size} color={color} strokeWidth={1.7} accessible={false} />
  );
}
