import { destinationIconGroups, type IconName } from './icons';
import type { Destination } from './types';

/** The colors a teacher can give a destination: a strong shade for icons and a soft one behind them. */
export const destinationColors = {
  green: { strong: '#1e6b43', soft: '#e1f0e6' },
  blue: { strong: '#2361a6', soft: '#e1ecf8' },
  teal: { strong: '#0f6f68', soft: '#dbf1ee' },
  purple: { strong: '#6a4cbb', soft: '#ece6f8' },
  pink: { strong: '#b03a68', soft: '#f8e2eb' },
  orange: { strong: '#b4530b', soft: '#fbebd9' },
  yellow: { strong: '#86680a', soft: '#f8f0cb' },
  gray: { strong: '#4b5563', soft: '#eceef0' },
} as const;

export type DestinationColor = keyof typeof destinationColors;

/** Every icon a teacher can give a destination, in picker order. */
export const destinationIcons = Object.values(destinationIconGroups).flat();

export type DestinationIcon = (typeof destinationIcons)[number];

/**
 * Words teachers search for that aren't in an icon's own name, so "restroom" finds the
 * toilet and "fountain" finds the water glass. Each icon's name is searched as well.
 */
const iconSearchWords: Partial<Record<DestinationIcon, string>> = {
  toilet: 'restroom bathroom washroom lavatory girls boys wc',
  droplet: 'water fountain drink',
  droplets: 'water fountain drink',
  'glass-water': 'drink fountain',
  bath: 'restroom bathroom washroom',
  baby: 'changing nursery',
  stethoscope: 'nurse health doctor clinic',
  pill: 'nurse medicine health',
  thermometer: 'nurse sick health',
  'heart-pulse': 'nurse health',
  bandage: 'nurse first aid health',
  cross: 'nurse first aid health',
  accessibility: 'wheelchair elevator special education',
  building: 'office main front',
  school: 'office main front',
  'heart-handshake': 'counselor counseling social worker support',
  'user-round': 'teacher person counselor room',
  users: 'teachers people group',
  contact: 'teacher person',
  briefcase: 'office principal administrator',
  'clipboard-list': 'attendance office',
  phone: 'call office',
  landmark: 'principal office',
  shield: 'security resource officer dean',
  'badge-check': 'dean administrator',
  'book-open': 'library reading',
  library: 'books',
  laptop: 'computer lab technology tech',
  monitor: 'computer lab technology tech',
  pencil: 'class room teacher',
  'notebook-pen': 'class room teacher homework',
  'graduation-cap': 'class room teacher',
  'flask-conical': 'science lab chemistry',
  microscope: 'science lab biology',
  calculator: 'math',
  palette: 'art',
  music: 'band choir orchestra',
  drama: 'theater theatre',
  globe: 'social studies geography',
  utensils: 'cafeteria lunch food',
  coffee: 'lounge',
  apple: 'snack food',
  sandwich: 'lunch cafeteria food',
  dumbbell: 'gym pe physical education',
  trophy: 'gym athletics coach',
  volleyball: 'gym ball',
  trees: 'outside playground',
  sun: 'outside recess',
  armchair: 'lounge calm corner',
  backpack: 'locker',
  'door-open': 'exit leave room',
  key: 'locker',
  package: 'delivery mail',
  car: 'parking pickup',
  bus: 'pickup',
  house: 'home',
  recycle: 'trash',
  trash: 'garbage',
  shirt: 'clothes uniform',
  smartphone: 'phone',
  wrench: 'custodian maintenance',
  brush: 'custodian janitor',
};

/** Whether an icon matches what the teacher typed: every word must appear in its name or search words. */
export function iconMatchesSearch(icon: DestinationIcon, search: string) {
  const words = `${icon.replaceAll('-', ' ')} ${iconSearchWords[icon] ?? ''}`;
  return search
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((typed) => words.includes(typed));
}

/** Icons renamed by newer versions of Lucide, so older saved destinations keep theirs. */
const renamedIcons: Record<string, DestinationIcon> = { 'building-2': 'building' };

/** A saved icon name that is still on the list, or the closest stand-in. */
export function knownIcon(name: string): DestinationIcon {
  if ((destinationIcons as readonly string[]).includes(name)) return name as DestinationIcon;
  return renamedIcons[name] ?? 'map-pin';
}

/**
 * Every new account starts with these, so students can take a pass on day one.
 * Two bathrooms, each one at a time, show from the start that every
 * destination with a limit has its own line: someone waiting for one bathroom
 * never holds up the other. Teachers rename them to fit their school.
 */
export function defaultDestinations(newId: () => string): Destination[] {
  return [
    { id: newId(), label: 'Bathroom 1', minutes: 5, color: 'blue', icon: 'toilet', limit: 1 },
    { id: newId(), label: 'Bathroom 2', minutes: 5, color: 'teal', icon: 'toilet', limit: 1 },
  ];
}

/**
 * How a pass's destination should look. Passes keep the destination's name, so
 * history still reads correctly if the destination is renamed or removed; a
 * name no longer on the list is drawn in grey.
 */
export function lookFor(destinations: Pick<Destination, 'label' | 'color' | 'icon'>[], label: string) {
  const match = destinations.find((destination) => destination.label === label);
  const color = destinationColors[match?.color ?? 'gray'];
  return { icon: knownIcon(match?.icon ?? 'map-pin') as IconName, strong: color.strong, soft: color.soft };
}
