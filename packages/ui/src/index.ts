/**
 * @papopro/ui — design system do produto.
 *
 * Princípios:
 *  - Os apps importam SEMPRE daqui (`@papopro/ui`), nunca direto de `radix-ui`.
 *  - Cores via tokens semânticos (`bg-primary`, `text-muted-foreground`) — nunca hex.
 *  - Variantes com `cva`. Estilos coesos vivem no componente, não em strings espalhadas.
 *  - Server Components por default; `'use client'` só quando o primitivo precisa
 *    de estado/listener (Dialog, Dropdown, Tooltip, ThemeProvider).
 */

// Utils
export { cn } from './utils/cn';

// Primitivos
export { Avatar, AvatarFallback, AvatarImage } from './components/avatar';
export { Badge, badgeVariants, type BadgeProps } from './components/badge';
export { Button, buttonVariants, type ButtonProps } from './components/button';
export {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from './components/card';
export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from './components/dropdown-menu';
export { Input, type InputProps } from './components/input';
export { ScrollArea, ScrollBar } from './components/scroll-area';
export { Separator } from './components/separator';
export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetPortal,
  SheetTitle,
  SheetTrigger,
} from './components/sheet';
export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './components/tooltip';

// Domínio
export {
  BrandArcs,
  type BrandArcsProps,
  type BrandArcsVariant,
} from './components/brand-arcs';
export { EmptyState } from './components/empty-state';
export { KbdShortcut } from './components/kbd-shortcut';
export { LogoFull, LogoMark } from './components/logo';
export { PageHeader } from './components/page-header';
export { StatusDot, type StatusTone } from './components/status-dot';
export { TemperatureBadge, type LeadTemperature } from './components/temperature-badge';

// Tema
export { ThemeProvider } from './components/theme-provider';
export { ThemeToggle } from './components/theme-toggle';
