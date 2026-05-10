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
export {
  AutoResizeTextarea,
  type AutoResizeTextareaProps,
} from './components/auto-resize-textarea';
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
export { Checkbox } from './components/checkbox';
export { Combobox, type ComboboxOption } from './components/combobox';
export {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from './components/command';
export {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuPortal,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from './components/context-menu';
export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from './components/dialog';
export {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  DrawerPortal,
  DrawerTitle,
  DrawerTrigger,
} from './components/drawer';
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
export {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  useFormField,
} from './components/form';
export { Input, type InputProps } from './components/input';
export { Label } from './components/label';
export { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from './components/popover';
export { RadioGroup, RadioGroupItem } from './components/radio-group';
export { ScrollArea, ScrollBar } from './components/scroll-area';
export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from './components/select';
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
export { Skeleton } from './components/skeleton';
export { Switch } from './components/switch';
export { Tabs, TabsContent, TabsList, TabsTrigger } from './components/tabs';
export { Textarea, type TextareaProps } from './components/textarea';
export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './components/tooltip';

// Domínio
export { BrandArcs, type BrandArcsProps, type BrandArcsVariant } from './components/brand-arcs';
export { EmptyState } from './components/empty-state';
export { ErrorState } from './components/error-state';
export { KbdShortcut } from './components/kbd-shortcut';
export { LoadingState } from './components/loading-state';
export { LogoFull, LogoMark } from './components/logo';
export { PageHeader } from './components/page-header';
export { StatusDot, type StatusTone } from './components/status-dot';
export { TemperatureBadge, type LeadTemperature } from './components/temperature-badge';

// Tema
export { ThemeProvider } from './components/theme-provider';
export { ThemeToggle } from './components/theme-toggle';
