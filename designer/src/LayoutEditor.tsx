import { useState } from 'react';
import { createDefaultDashboardCards, type DashboardCardLayout } from '../../src/data/dashboardLayout';

export type DesignerElementType = 'section' | 'card' | 'heading' | 'text' | 'button' | 'indicator';
export interface DesignerElement {
  id: string; type: DesignerElementType; title: string; content: string;
  column: number; row: number; columnSpan: number; rowSpan: number;
}
export interface DesignerLayout {
  schemaVersion: 1;
  grid: { columns: number; rows: number; gap: number; snap: boolean };
  elements: DesignerElement[];
  cards?: DashboardCardLayout[];
}
interface Props {
  layout: DesignerLayout; dirty: boolean; saving: boolean;
  onChange: (layout: DesignerLayout) => void; onSave: () => void;
}
const labels: Record<DesignerElementType, string> = {
  section: 'Секция', card: 'Карточка', heading: 'Заголовок',
  text: 'Текст', button: 'Кнопка', indicator: 'Индикатор',
};
const columns: Record<number, string> = {
  1:'grid-cols-1',2:'grid-cols-2',3:'grid-cols-3',4:'grid-cols-4',5:'grid-cols-5',6:'grid-cols-6',
  7:'grid-cols-7',8:'grid-cols-8',9:'grid-cols-9',10:'grid-cols-10',11:'grid-cols-11',12:'grid-cols-12',
};
const spans: Record<number, string> = {
  1:'col-span-1',2:'col-span-2',3:'col-span-3',4:'col-span-4',5:'col-span-5',6:'col-span-6',
  7:'col-span-7',8:'col-span-8',9:'col-span-9',10:'col-span-10',11:'col-span-11',12:'col-span-12',
};
const starts: Record<number, string> = {
  1:'col-start-1',2:'col-start-2',3:'col-start-3',4:'col-start-4',5:'col-start-5',6:'col-start-6',
  7:'col-start-7',8:'col-start-8',9:'col-start-9',10:'col-start-10',11:'col-start-11',12:'col-start-12',
};
const rowStarts: Record<number, string> = {
  1:'row-start-1',2:'row-start-2',3:'row-start-3',4:'row-start-4',5:'row-start-5',6:'row-start-6',
  7:'row-start-7',8:'row-start-8',9:'row-start-9',10:'row-start-10',11:'row-start-11',12:'row-start-12',
};
const rowSpans: Record<number, string> = {
  1:'row-span-1',2:'row-span-2',3:'row-span-3',4:'row-span-4',
  5:'row-span-5',6:'row-span-6',7:'row-span-7',8:'row-span-8',
};
const gaps: Record<number, string> = {1:'gap-1',2:'gap-2',3:'gap-3',4:'gap-4',5:'gap-5',6:'gap-6'};

export function createDefaultDesignerLayout(): DesignerLayout {
  return {
    schemaVersion: 1,
    grid: { columns: 12, rows: 4, gap: 3, snap: true },
    cards: createDefaultDashboardCards(),
    elements: [
      { id: 'dashboard-system', type: 'section', title: 'Состояние системы', content: 'Реальный блок дашборда', column: 1, row: 1, columnSpan: 12, rowSpan: 1 },
      { id: 'dashboard-ai', type: 'section', title: 'AI-инфраструктура', content: 'Реальный блок дашборда', column: 1, row: 2, columnSpan: 12, rowSpan: 1 },
      { id: 'dashboard-activity', type: 'section', title: 'Рабочая активность', content: 'Реальный блок дашборда', column: 1, row: 3, columnSpan: 12, rowSpan: 1 },
      { id: 'dashboard-issues', type: 'section', title: 'Требует внимания', content: 'Реальный блок дашборда', column: 1, row: 4, columnSpan: 12, rowSpan: 1 },
    ],
  };
}
function validate(layout: DesignerLayout): boolean {
  const ids = new Set<string>();
  const occupied = new Set<string>();
  for (const item of layout.elements) {
    if (ids.has(item.id) || item.column < 1 || item.row < 1 || item.columnSpan < 1 || item.rowSpan < 1 ||
      item.column + item.columnSpan - 1 > layout.grid.columns ||
      item.row + item.rowSpan - 1 > layout.grid.rows) return false;
    ids.add(item.id);
    for (let row = item.row; row < item.row + item.rowSpan; row += 1) {
      for (let column = item.column; column < item.column + item.columnSpan; column += 1) {
        const cell = `${column}:${row}`;
        if (occupied.has(cell)) return false;
        occupied.add(cell);
      }
    }
  }
  return true;
}
export function LayoutEditor({layout,dirty,saving,onChange,onSave}: Props) {
  const [selectedId,setSelectedId] = useState(layout.elements[0]?.id ?? '');
  const [draggedId,setDraggedId] = useState<string | null>(null);
  const [selectedCardId,setSelectedCardId] = useState('cpu');
  const [error,setError] = useState('');
  const selected = layout.elements.find(item => item.id === selectedId) ?? null;
  const cards = layout.cards ?? createDefaultDashboardCards();
  const selectedCard = cards.find(item => item.id === selectedCardId) ?? cards[0] ?? null;
  const change = (next: DesignerLayout) => {
    if (!validate(next)) { setError('Элемент выходит за границы сетки. Изменение отменено.'); return; }
    setError(''); onChange(next);
  };
  const update = (patch: Partial<DesignerElement>) => {
    if (selected) change({...layout,elements:layout.elements.map(item => item.id === selected.id ? {...item,...patch} : item)});
  };
  const drop = (targetId: string) => {
    if (!draggedId || draggedId===targetId) return;
    const source=layout.elements.find(item=>item.id===draggedId);
    const target=layout.elements.find(item=>item.id===targetId);
    if (!source || !target) return;
    change({...layout,elements:layout.elements.map(item=>item.id===source.id?{...item,column:target.column,row:target.row}:item.id===target.id?{...item,column:source.column,row:source.row}:item)});
    setDraggedId(null);
  };
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="text-base font-semibold">Визуальный конструктор</h3><p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">CSS Grid · {layout.elements.length} элементов · {dirty?'есть несохранённые изменения':'сохранённая версия'}</p></div>
      <button type="button" onClick={onSave} disabled={!dirty||saving} className="h-9 rounded-lg bg-blue-600 px-4 text-xs font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50">{saving?'Сохранение…':'Сохранить макет'}</button>
    </div>
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
      <section className="min-w-0 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-3 flex items-center justify-between gap-2"><span className="text-xs font-semibold">Холст дашборда</span><span className="text-[10px] text-zinc-500 dark:text-zinc-400">4 секции · 12 защищённых карточек</span></div>
        <div className={`grid min-h-[34rem] auto-rows-[minmax(5rem,auto)] content-start ${columns[layout.grid.columns]} ${gaps[layout.grid.gap]} rounded-lg border border-dashed border-zinc-300 bg-zinc-100 p-3 dark:border-zinc-700 dark:bg-zinc-950`}>
          {Array.from({length:layout.grid.rows},(_,rowIndex)=>Array.from({length:layout.grid.columns},(_,columnIndex)=>(
            <div key={`grid-cell-${columnIndex+1}-${rowIndex+1}`} className={`pointer-events-none col-span-1 row-span-1 ${starts[columnIndex+1]} ${rowStarts[rowIndex+1]} rounded border border-dashed border-zinc-300/70 dark:border-zinc-700/70`}/>
          )))}
          {layout.elements.map(item=><article key={item.id} draggable onDragStart={()=>setDraggedId(item.id)} onDragEnd={()=>setDraggedId(null)} onDragOver={event=>event.preventDefault()} onDrop={event=>{event.preventDefault();drop(item.id);}} onClick={()=>setSelectedId(item.id)} className={`relative min-w-0 cursor-grab overflow-hidden rounded-lg border p-3 text-left active:cursor-grabbing ${starts[item.column]??'col-start-1'} ${spans[item.columnSpan]??'col-span-1'} ${rowStarts[item.row]??'row-start-1'} ${rowSpans[item.rowSpan]??'row-span-1'} ${selectedId===item.id?'border-blue-500 bg-blue-50 ring-2 ring-blue-500/20 dark:bg-blue-950/40':'border-zinc-300 bg-white hover:border-blue-400 dark:border-zinc-700 dark:bg-zinc-900'}`}>
            <div className="flex items-center justify-between gap-2"><span className="truncate text-xs font-semibold">{item.title}</span><span className="text-[9px] text-zinc-500 dark:text-zinc-400">{labels[item.type]}</span></div>
            <p className="mt-2 line-clamp-2 text-[11px] text-zinc-600 dark:text-zinc-400">{item.content}</p>
            {cards.filter(card=>card.sectionId===item.id).map(card=><button key={card.id} type="button" onClick={event=>{event.stopPropagation();setSelectedCardId(card.id);}} className={`mt-2 mr-1 rounded-md border px-2 py-1 text-[10px] ${selectedCardId===card.id?'border-blue-500 bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200':'border-zinc-300 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300'}`}>{card.title}</button>)}
            <span className="absolute bottom-1 right-2 text-[9px] text-zinc-400">{item.column}:{item.row} · {item.columnSpan}×{item.rowSpan}</span>
          </article>)}
        </div>
        <p className="mt-2 text-[10px] text-zinc-500 dark:text-zinc-400">Перетаскивание между элементами меняет их позиции. Точная геометрия задаётся в инспекторе.</p>
        {error&&<p role="alert" className="mt-2 text-xs text-rose-600 dark:text-rose-400">{error}</p>}
      </section>
      <aside className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div><h4 className="text-sm font-semibold">Параметры сетки</h4><div className="mt-3 space-y-3">
          <label className="block space-y-1 text-xs"><span className="text-zinc-500 dark:text-zinc-400">Колонки</span><select value={layout.grid.columns} onChange={event=>{const columnsCount=Number(event.target.value);change({...layout,grid:{...layout.grid,columns:columnsCount},elements:layout.elements.map(item=>({...item,column:Math.min(item.column,columnsCount),columnSpan:Math.min(item.columnSpan,columnsCount)}))});}} className="h-9 w-full rounded-lg border border-zinc-300 bg-white px-2 dark:border-zinc-700 dark:bg-zinc-950">{Array.from({length:12},(_,i)=>i+1).map(value=><option key={value}>{value}</option>)}</select></label>
          <label className="block space-y-1 text-xs"><span className="text-zinc-500 dark:text-zinc-400">Строки</span><select value={layout.grid.rows} onChange={event=>{const rows=Number(event.target.value);change({...layout,grid:{...layout.grid,rows},elements:layout.elements.map(item=>({...item,row:Math.min(item.row,rows),rowSpan:Math.min(item.rowSpan,rows)}))});}} className="h-9 w-full rounded-lg border border-zinc-300 bg-white px-2 dark:border-zinc-700 dark:bg-zinc-950">{Array.from({length:12},(_,i)=>i+1).map(value=><option key={value}>{value}</option>)}</select></label>
          <label className="block space-y-1 text-xs"><span className="text-zinc-500 dark:text-zinc-400">Интервал</span><select value={layout.grid.gap} onChange={event=>change({...layout,grid:{...layout.grid,gap:Number(event.target.value)}})} className="h-9 w-full rounded-lg border border-zinc-300 bg-white px-2 dark:border-zinc-700 dark:bg-zinc-950">{[1,2,3,4,5,6].map(value=><option key={value} value={value}>{value*4} px</option>)}</select></label>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={layout.grid.snap} onChange={event=>change({...layout,grid:{...layout.grid,snap:event.target.checked}})}/>Привязка к сетке</label>
        </div></div>
        <div className="border-t border-zinc-200 pt-4 dark:border-zinc-800"><h4 className="text-sm font-semibold">Карточки дашборда</h4>
          <div className="mt-3 space-y-3">
            <label className="block space-y-1 text-xs"><span className="text-zinc-500 dark:text-zinc-400">Реальный блок</span><select value={selectedCard?.id ?? ''} onChange={event=>setSelectedCardId(event.target.value)} className="h-9 w-full rounded-lg border border-zinc-300 bg-white px-2 dark:border-zinc-700 dark:bg-zinc-950">{cards.map(card=><option key={card.id} value={card.id}>{card.title}</option>)}</select></label>
            {selectedCard && <><label className="block space-y-1 text-xs"><span className="text-zinc-500 dark:text-zinc-400">Заголовок карточки</span><input value={selectedCard.title} maxLength={80} onChange={event=>change({...layout,cards:cards.map(card=>card.id===selectedCard.id?{...card,title:event.target.value}:card)})} className="h-9 w-full rounded-lg border border-zinc-300 bg-white px-2 dark:border-zinc-700 dark:bg-zinc-950"/></label>
            <label className="block space-y-1 text-xs"><span className="text-zinc-500 dark:text-zinc-400">Позиция внутри секции</span><select value={selectedCard.order} onChange={event=>{const order=Number(event.target.value);const previous=selectedCard.order;change({...layout,cards:cards.map(card=>card.id===selectedCard.id?{...card,order}:card.sectionId===selectedCard.sectionId&&card.order===order?{...card,order:previous}:card)});}} className="h-9 w-full rounded-lg border border-zinc-300 bg-white px-2 dark:border-zinc-700 dark:bg-zinc-950">{[1,2,3,4].map(value=><option key={value} value={value}>{value}</option>)}</select></label>
            <label className="block space-y-1 text-xs"><span className="text-zinc-500 dark:text-zinc-400">Оформление</span><select value={selectedCard.appearance ?? 'default'} onChange={event=>change({...layout,cards:cards.map(card=>card.id===selectedCard.id?{...card,appearance:event.target.value as DashboardCardLayout['appearance']}:card)})} className="h-9 w-full rounded-lg border border-zinc-300 bg-white px-2 dark:border-zinc-700 dark:bg-zinc-950"><option value="default">Стандартное</option><option value="muted">Приглушённое</option><option value="accent">Акцентное</option></select></label>
            <label className="block space-y-1 text-xs"><span className="text-zinc-500 dark:text-zinc-400">Плотность</span><select value={selectedCard.density ?? 'normal'} onChange={event=>change({...layout,cards:cards.map(card=>card.id===selectedCard.id?{...card,density:event.target.value as DashboardCardLayout['density']}:card)})} className="h-9 w-full rounded-lg border border-zinc-300 bg-white px-2 dark:border-zinc-700 dark:bg-zinc-950"><option value="compact">Компактная</option><option value="normal">Обычная</option><option value="spacious">Свободная</option></select></label>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400">Данные, индикаторы и обработчик перехода карточки защищены. Настраиваются заголовок, порядок, визуальный тон и плотность.</p></>}
          </div>
        </div>
        <div className="border-t border-zinc-200 pt-4 dark:border-zinc-800"><h4 className="text-sm font-semibold">Инспектор секции</h4>
          {selected?<div className="mt-3 space-y-3">
            
            <label className="block space-y-1 text-xs"><span className="text-zinc-500 dark:text-zinc-400">Заголовок</span><input value={selected.title} onChange={event=>update({title:event.target.value})} className="h-9 w-full rounded-lg border border-zinc-300 bg-white px-2 dark:border-zinc-700 dark:bg-zinc-950"/></label>
            
            <div className="grid grid-cols-2 gap-2">
              {([['column','Колонка',layout.grid.columns],['row','Строка',layout.grid.rows],['columnSpan','Ширина',layout.grid.columns],['rowSpan','Высота',8]] as const).map(([key,label,max])=><label key={key} className="space-y-1 text-xs"><span className="text-zinc-500 dark:text-zinc-400">{label}</span><select value={selected[key]} onChange={event=>update({[key]:Number(event.target.value)})} className="h-9 w-full rounded-lg border border-zinc-300 bg-white px-2 dark:border-zinc-700 dark:bg-zinc-950">{Array.from({length:max},(_,i)=>i+1).map(value=><option key={value}>{value}</option>)}</select></label>)}
            </div>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400">Системные секции защищены от удаления, чтобы не отключить показатели и переходы дашборда.</p>
          </div>:<p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">Выбери элемент на холсте.</p>}
        </div>
        <div className="border-t border-zinc-200 pt-4 dark:border-zinc-800"><p className="text-[10px] text-zinc-500 dark:text-zinc-400">Макет применяется к реальным секциям дашборда OneCoreAI. Показатели, данные и обработчики остаются в исходных компонентах.</p><button type="button" onClick={()=>onChange(createDefaultDesignerLayout())} className="mt-3 h-8 w-full rounded-lg border border-zinc-300 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">Сбросить макет</button></div>
      </aside>
    </div>
  </div>;
}
