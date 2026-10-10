import {
  Check,
  ChevronRight,
  Map,
  Moon,
  Route,
  Shield,
  Sun,
  TriangleAlert,
  X,
  CalendarDays, ChevronDown, Search, SlidersHorizontal, ArrowUpRight, ArrowRight,
  Camera, Thermometer, Navigation, AudioLines,
} from "lucide-react-native";

const icons = {
  check: Check,
  chevron: ChevronRight,
  facility: Map,
  moon: Moon,
  missions: Route,
  shield: Shield,
  sun: Sun,
  attention: TriangleAlert,
  close: X,
  calendar: CalendarDays, down: ChevronDown, search: Search, filters: SlidersHorizontal,
  external: ArrowUpRight, arrow: ArrowRight, camera: Camera, temperature: Thermometer,
  navigation: Navigation, signal: AudioLines,
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
