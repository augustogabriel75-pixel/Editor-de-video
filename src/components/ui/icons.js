/** Mapa nome -> componente Lucide para ícones referenciados por dados (motions, trilhas…). */
import {
  Coins, Rocket, Heart, Lightbulb, TrendingUp, Clock, Trophy, Flame, Sparkles, Focus, MousePointer2, Globe,
  TriangleAlert, Users, CircleCheck, Type, ZoomIn, ZoomOut, Activity, Move, Zap, Film, Image, Music, Captions,
  Layers, AudioLines, Wand2, Video,
} from 'lucide-react';

export const ICONS = {
  Coins, Rocket, Heart, Lightbulb, TrendingUp, Clock, Trophy, Flame, Sparkles, Focus, MousePointer2, Globe,
  TriangleAlert, Users, CircleCheck, Type, ZoomIn, ZoomOut, Activity, Move, Zap, Film, Image, Music, Captions,
  Layers, AudioLines, Wand2, Video,
};

export const iconFor = (name) => ICONS[name] || Sparkles;

export const TRACK_ICONS = { video: Film, overlay: Layers, text: Type, audio: AudioLines, motion: Wand2 };
