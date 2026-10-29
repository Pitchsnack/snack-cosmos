import {
  Armchair, BrickWall, Briefcase, Building, Car, Cog, Cpu, Factory, FlaskConical, HardHat, Hotel, House, Landmark, Laptop,
  Newspaper, Package, Pickaxe, Pill, Printer, Shirt, ShieldCheck, ShoppingBag, Sprout, Stethoscope, TrendingUp, Truck,
  Utensils, Wheat, Zap, LayoutGrid, type LucideIcon,
} from "lucide-react";
import { boSector } from "@/lib/buy-orders";

const ICONS: Record<string, LucideIcon> = {
  armchair: Armchair, "brick-wall": BrickWall, briefcase: Briefcase, building: Building, car: Car, cog: Cog, cpu: Cpu, factory: Factory,
  "flask-conical": FlaskConical, "hard-hat": HardHat, hotel: Hotel, house: House, landmark: Landmark, laptop: Laptop, newspaper: Newspaper,
  package: Package, pickaxe: Pickaxe, pill: Pill, printer: Printer, shirt: Shirt, "shield-check": ShieldCheck, "shopping-bag": ShoppingBag,
  sprout: Sprout, stethoscope: Stethoscope, "trending-up": TrendingUp, truck: Truck, utensils: Utensils, wheat: Wheat, zap: Zap,
};
export const iconByName = (n: string | null | undefined): LucideIcon => (n && ICONS[n]) || LayoutGrid;
export const sectorIcon = (sector: string | null | undefined) => iconByName(boSector(sector)?.icon);
