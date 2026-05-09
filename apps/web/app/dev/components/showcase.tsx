'use client';

import * as React from 'react';

import toast from 'react-hot-toast';

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  BrandArcs,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Checkbox,
  Combobox,
  type ComboboxOption,
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
  EmptyState,
  ErrorState,
  Input,
  KbdShortcut,
  Label,
  LoadingState,
  Popover,
  PopoverContent,
  PopoverTrigger,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  Skeleton,
  StatusDot,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  TemperatureBadge,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@papopro/ui';
import {
  Bell,
  Calendar,
  CheckCircle2,
  Copy,
  Edit,
  Inbox,
  KanbanSquare,
  Mail,
  Plus,
  Send,
  Settings,
  Trash2,
  User,
  Users,
} from '@papopro/ui/icons';

const VENDORS: ComboboxOption[] = [
  { value: 'ana', label: 'Ana Pereira', keywords: 'sdr norte' },
  { value: 'bruno', label: 'Bruno Lima', keywords: 'closer sul' },
  { value: 'carla', label: 'Carla Souza', keywords: 'sdr nordeste' },
  { value: 'daniel', label: 'Daniel Reis', keywords: 'closer sudeste' },
];

export function ComponentsShowcase() {
  const [comboValue, setComboValue] = React.useState<string | null>(null);
  const [switchOn, setSwitchOn] = React.useState(true);
  const [checkboxOn, setCheckboxOn] = React.useState(true);

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-12">
        <Section title="Tipografia & Marca" description="Pesos Poppins (CLAUDE.md §8) e logos.">
          <div className="grid gap-3">
            <p className="text-title-lg">Title-lg · 24/32 · weight 600</p>
            <p className="text-title">Title · 18/24 · weight 600</p>
            <p className="text-body-lg">Body-lg · 16/24 · weight 400</p>
            <p className="text-body">Body · 14/20 · weight 400</p>
            <p className="text-caption">Caption · 12/16 · weight 500</p>
          </div>
          <div className="border-border bg-card relative h-32 overflow-hidden rounded-lg border">
            <BrandArcs className="absolute inset-0" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-foreground text-body font-semibold">BrandArcs</span>
            </div>
          </div>
        </Section>

        <Section
          title="Cores semânticas"
          description="Tokens (CLAUDE.md §8). Todos os componentes referenciam estes — zero hex no app."
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Swatch className="bg-primary text-primary-foreground" label="primary" />
            <Swatch className="bg-accent text-accent-foreground" label="accent" />
            <Swatch className="bg-success text-success-foreground" label="success" />
            <Swatch className="bg-warning text-warning-foreground" label="warning" />
            <Swatch className="bg-destructive text-destructive-foreground" label="destructive" />
            <Swatch className="bg-info text-info-foreground" label="info" />
            <Swatch className="bg-muted text-muted-foreground" label="muted" />
            <Swatch
              className="bg-card text-card-foreground border-border border"
              label="card / popover"
            />
          </div>
        </Section>

        <Section title="Buttons" description="Variantes via `cva`.">
          <div className="flex flex-wrap gap-3">
            <Button>Default</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="link">Link</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm">Small</Button>
            <Button size="default">Default</Button>
            <Button size="lg">Large</Button>
            <Button size="icon" aria-label="Adicionar">
              <Plus />
            </Button>
            <Button disabled>Disabled</Button>
          </div>
        </Section>

        <Section title="Inputs & Form primitives">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dev-input">Email</Label>
              <Input id="dev-input" type="email" placeholder="voce@empresa.com" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dev-textarea">Anotações</Label>
              <Textarea id="dev-textarea" placeholder="Resuma a conversa…" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dev-select">Etapa do funil</Label>
              <Select>
                <SelectTrigger id="dev-select">
                  <SelectValue placeholder="Selecione a etapa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="novo">Novo</SelectItem>
                  <SelectItem value="contato">Em contato</SelectItem>
                  <SelectItem value="proposta">Proposta</SelectItem>
                  <SelectItem value="negociacao">Negociação</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dev-combobox">Vendedor responsável</Label>
              <Combobox
                id="dev-combobox"
                options={VENDORS}
                value={comboValue}
                onChange={setComboValue}
                placeholder="Atribuir a…"
                searchPlaceholder="Buscar vendedor"
                emptyMessage="Nenhum vendedor encontrado"
              />
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="flex items-start gap-2.5">
              <Checkbox
                id="dev-checkbox"
                checked={checkboxOn}
                onCheckedChange={(v) => setCheckboxOn(v === true)}
              />
              <Label htmlFor="dev-checkbox" className="leading-snug">
                Aceito receber novidades por email
              </Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="dev-switch"
                checked={switchOn}
                onCheckedChange={setSwitchOn}
                aria-label="Ativar alertas"
              />
              <Label htmlFor="dev-switch">Ativar alertas de lead frio</Label>
            </div>
          </div>

          <RadioGroup defaultValue="weekly" className="grid gap-3">
            <div className="flex items-center gap-2.5">
              <RadioGroupItem id="dev-radio-daily" value="daily" />
              <Label htmlFor="dev-radio-daily">Diário</Label>
            </div>
            <div className="flex items-center gap-2.5">
              <RadioGroupItem id="dev-radio-weekly" value="weekly" />
              <Label htmlFor="dev-radio-weekly">Semanal</Label>
            </div>
            <div className="flex items-center gap-2.5">
              <RadioGroupItem id="dev-radio-monthly" value="monthly" />
              <Label htmlFor="dev-radio-monthly">Mensal</Label>
            </div>
          </RadioGroup>
        </Section>

        <Section title="Status & Dados">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <StatusDot tone="online" pulse />
              <span className="text-body">Conectado</span>
            </div>
            <div className="flex items-center gap-2">
              <StatusDot tone="idle" />
              <span className="text-body">Instável</span>
            </div>
            <div className="flex items-center gap-2">
              <StatusDot tone="offline" />
              <span className="text-body">Desconectado</span>
            </div>
            <div className="flex items-center gap-2">
              <StatusDot tone="neutral" />
              <span className="text-body">Indeterminado</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <TemperatureBadge temperature="hot" />
            <TemperatureBadge temperature="warm" />
            <TemperatureBadge temperature="cold" />
            <Badge>Nova</Badge>
            <Badge variant="secondary">Em contato</Badge>
            <Badge variant="outline">Negociação</Badge>
            <Badge variant="destructive">Perdida</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Avatar>
              <AvatarImage alt="Ana" src="https://i.pravatar.cc/64?img=47" />
              <AvatarFallback>AP</AvatarFallback>
            </Avatar>
            <Avatar>
              <AvatarFallback>BR</AvatarFallback>
            </Avatar>
            <KbdShortcut keys={['G', 'N']} />
            <KbdShortcut keys={['Ctrl', 'K']} />
          </div>
        </Section>

        <Section title="Cards & Layout">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Pipeline aberto</CardTitle>
                <CardDescription>Total de oportunidades em curso</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-foreground text-title-lg font-semibold">R$ 482.300</p>
                <p className="text-muted-foreground text-caption">
                  42 negócios · ticket médio R$ 11.483
                </p>
              </CardContent>
              <CardFooter>
                <Button variant="outline" size="sm">
                  Ver pipeline
                </Button>
              </CardFooter>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Performance</CardTitle>
                <CardDescription>Taxa de conversão por etapa</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-2/3" />
              </CardContent>
            </Card>
          </div>
          <Separator />
        </Section>

        <Section title="Loading & Empty & Error">
          <div className="grid gap-4 md:grid-cols-3">
            <LoadingState size="md" label="Carregando leads…" />
            <EmptyState
              icon={Users}
              title="Nenhum lead ainda"
              description="Importe um CSV ou conecte uma fonte de captura para começar."
              action={
                <Button size="sm">
                  <Plus />
                  Adicionar lead
                </Button>
              }
            />
            <ErrorState
              title="Não foi possível carregar"
              description="Verifique sua conexão e tente recarregar a página."
              action={
                <Button size="sm" variant="outline">
                  Recarregar
                </Button>
              }
            />
          </div>
        </Section>

        <Section title="Tabs">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList>
              <TabsTrigger value="overview">
                <Inbox /> Visão geral
              </TabsTrigger>
              <TabsTrigger value="activity">
                <Bell /> Atividade
              </TabsTrigger>
              <TabsTrigger value="settings">
                <Settings /> Configurações
              </TabsTrigger>
            </TabsList>
            <TabsContent value="overview">
              <p className="text-muted-foreground text-body">
                Volume diário, leads novos, próximas tarefas — tudo num painel só.
              </p>
            </TabsContent>
            <TabsContent value="activity">
              <p className="text-muted-foreground text-body">
                Timeline cronológica de mensagens, ligações e mudanças de etapa.
              </p>
            </TabsContent>
            <TabsContent value="settings">
              <p className="text-muted-foreground text-body">
                Pipeline, agentes, cadências, integrações.
              </p>
            </TabsContent>
          </Tabs>
        </Section>

        <Section title="Overlays">
          <div className="flex flex-wrap gap-3">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">Abrir Dialog</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Confirmar exclusão</DialogTitle>
                  <DialogDescription>
                    Essa ação não pode ser desfeita. O lead será removido permanentemente.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline">Cancelar</Button>
                  <Button variant="destructive">
                    <Trash2 /> Excluir
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline">Abrir Sheet</Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Filtros avançados</SheetTitle>
                  <SheetDescription>
                    Combine etapa, vendedor, origem e período para refinar a lista.
                  </SheetDescription>
                </SheetHeader>
              </SheetContent>
            </Sheet>

            <Drawer>
              <DrawerTrigger asChild>
                <Button variant="outline">Abrir Drawer</Button>
              </DrawerTrigger>
              <DrawerContent>
                <DrawerHeader>
                  <DrawerTitle>Criar tarefa rápida</DrawerTitle>
                  <DrawerDescription>
                    Útil em mobile, quando você precisa anotar algo durante a chamada.
                  </DrawerDescription>
                </DrawerHeader>
                <div className="px-4">
                  <Input placeholder="Título da tarefa" />
                </div>
                <DrawerFooter>
                  <Button>Criar</Button>
                </DrawerFooter>
              </DrawerContent>
            </Drawer>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline">
                  <Calendar /> Popover
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-72">
                <p className="text-foreground text-body font-medium">Próxima ação</p>
                <p className="text-muted-foreground text-caption mt-1">
                  Anota um lembrete sem abrir o detalhe do lead.
                </p>
              </PopoverContent>
            </Popover>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Ajuda">
                  <Mail />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Tooltip</TooltipContent>
            </Tooltip>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">DropdownMenu</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Ações</DropdownMenuLabel>
                <DropdownMenuItem>
                  <Edit /> Editar
                  <DropdownMenuShortcut>⌘E</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Copy /> Duplicar
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive">
                  <Trash2 /> Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <ContextMenu>
              <ContextMenuTrigger asChild>
                <Button variant="outline">Right-click aqui</Button>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuLabel>Lead</ContextMenuLabel>
                <ContextMenuItem>
                  <User /> Atribuir a…
                </ContextMenuItem>
                <ContextMenuItem>
                  <Send /> Enviar WhatsApp
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem className="text-destructive">
                  <Trash2 /> Excluir
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          </div>
        </Section>

        <Section title="Toasts (react-hot-toast)" description="Tokens semânticos via wrapper.">
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => toast.success('Lead atribuído.')}>
              <CheckCircle2 /> Toast de sucesso
            </Button>
            <Button variant="outline" onClick={() => toast.error('Não foi possível salvar.')}>
              Toast de erro
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const id = toast.loading('Sincronizando…');
                window.setTimeout(() => toast.success('Sincronizado.', { id }), 1200);
              }}
            >
              Toast loading → success
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                toast(
                  (t) => (
                    <span className="flex items-center gap-2">
                      <KanbanSquare className="text-primary size-4" />
                      Negócio movido para Proposta.
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toast.dismiss(t.id)}
                        className="ml-2"
                      >
                        Desfazer
                      </Button>
                    </span>
                  ),
                  { duration: 6000 },
                )
              }
            >
              Toast com ação
            </Button>
          </div>
        </Section>
      </div>
    </TooltipProvider>
  );
}

interface SectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

function Section({ title, description, children }: SectionProps) {
  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h2 className="text-foreground text-title font-semibold">{title}</h2>
        {description && <p className="text-muted-foreground text-body">{description}</p>}
      </header>
      <div className="flex flex-col gap-6">{children}</div>
    </section>
  );
}

function Swatch({ className, label }: { className: string; label: string }) {
  return (
    <div className={`flex h-20 flex-col justify-end rounded-md p-3 ${className}`}>
      <span className="text-caption font-medium">{label}</span>
    </div>
  );
}
