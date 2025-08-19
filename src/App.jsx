import React, { useMemo, useState } from 'react'
import { NavLink, Routes, Route } from 'react-router-dom'
import Papa from 'papaparse'

const currency = (n) => (Number(n)||0).toLocaleString(undefined, { style: 'currency', currency: 'USD' })
const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

const seedCategories = [
  { id: 'cat-utilities', name: 'Utilities', type: 'Expense' },
  { id: 'cat-insurance', name: 'Insurance', type: 'Expense' },
  { id: 'cat-shopping', name: 'Shopping', type: 'Expense' },
  { id: 'cat-groceries', name: 'Groceries', type: 'Expense' },
  { id: 'cat-dining', name: 'Dining', type: 'Expense' },
  { id: 'cat-income', name: 'Income', type: 'Income' },
  { id: 'cat-savings', name: 'Savings', type: 'Savings' },
  { id: 'cat-misc', name: 'Misc', type: 'Expense' },
]
const seedIncome = [
  { id: 'inc-1', date: '2025-07-01', source: 'Paycheck', amount: 2500, tags: ['salary'] },
  { id: 'inc-2', date: '2025-07-15', source: 'Paycheck', amount: 2500, tags: ['salary'] },
  { id: 'inc-3', date: '2025-07-20', source: 'Freelance', amount: 600, tags: ['side'] },
]
const seedBills = [
  { id: 'bill-1', due: '2025-07-20', name: 'Electricity', category: 'Utilities', amount: 150, status: 'due' },
  { id: 'bill-2', due: '2025-07-25', name: 'Internet', category: 'Utilities', amount: 80, status: 'paid' },
  { id: 'bill-3', due: '2025-07-10', name: 'Allstate Insurance', category: 'Insurance', amount: 460, status: 'paid' },
  { id: 'bill-4', due: '2025-07-05', name: 'Groceries (weekly)', category: 'Groceries', amount: 200, status: 'due' },
]

export default function App(){
  const [categories, setCategories] = useState(seedCategories)
  const [income, setIncome] = useState(seedIncome)
  const [bills, setBills] = useState(seedBills)
  const [sheetUrl, setSheetUrl] = useState('')
  const [sheetRows, setSheetRows] = useState([])

  const onUpload = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    Papa.parse(file, { header: true, dynamicTyping: true, skipEmptyLines: true,
      complete: (res)=> setSheetRows(res.data||[]) })
  }
  const loadSheet = async () => {
    if (!sheetUrl) return;
    const res = await fetch(sheetUrl, { cache: 'no-store' })
    const text = await res.text()
    const parsed = Papa.parse(text, { header: true, dynamicTyping: true, skipEmptyLines: true });
    setSheetRows(parsed.data||[]);
  }

  return (
    <div className="min-h-screen bg-stone-100 text-stone-800">
      <div className="max-w-7xl mx-auto p-4 grid grid-cols-12 gap-4">
        <aside className="col-span-12 md:col-span-3 lg:col-span-2">
          <div className="bg-stone-50 rounded-2xl shadow-sm p-4">
            <div className="text-xl font-semibold mb-2">Budget</div>
            <Nav to="/">Dashboard</Nav>
            <Nav to="/categories">Categories</Nav>
            <Nav to="/income">Income</Nav>
            <Nav to="/bills">Bills</Nav>
            <div className="mt-4 border-t border-stone-200 pt-3 text-sm">
              <div className="font-medium mb-2">Data (Google Sheet / CSV)</div>
              <input className="w-full text-sm px-3 py-2 rounded-lg bg-stone-100" placeholder="Published CSV URL" value={sheetUrl} onChange={(e)=> setSheetUrl(e.target.value)} />
              <div className="flex gap-2 mt-2">
                <button className="px-3 py-1.5 rounded-lg bg-stone-800 text-white text-sm" onClick={loadSheet}>Load</button>
                <label className="px-3 py-1.5 rounded-lg bg-stone-700 text-white text-sm cursor-pointer">
                  Upload CSV<input type="file" accept=".csv" className="hidden" onChange={onUpload}/>
                </label>
              </div>
              <div className="text-xs text-stone-500 mt-2">{sheetRows.length} rows loaded</div>
            </div>
          </div>
        </aside>
        <main className="col-span-12 md:col-span-9 lg:col-span-10">
          <Routes>
            <Route index element={<Dashboard income={income} bills={bills} />} />
            <Route path="/categories" element={<CategoriesPage rows={categories} setRows={setCategories} />} />
            <Route path="/income" element={<IncomePage rows={income} setRows={setIncome} />} />
            <Route path="/bills" element={<BillsPage rows={bills} setRows={setBills} />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

function Nav({ to, children }){
  return <NavLink to={to} className={({isActive})=> `block px-3 py-2 rounded-xl text-sm ${isActive?'bg-stone-200 font-semibold':'hover:bg-stone-200'}`}>{children}</NavLink>
}

function Dashboard({ income, bills }){
  const totalIncome = useMemo(()=> income.reduce((s,i)=> s+Number(i.amount||0),0), [income])
  const totalExpenses = useMemo(()=> bills.reduce((s,b)=> s+Number(b.amount||0),0), [bills])
  const net = totalIncome - totalExpenses

  const byMonth = (rows, key) => {
    const map = new Map(months.map((_,i)=> [i,0]))
    rows.forEach(r=> {
      const d = new Date(r[key==='income'?'date':'due'])
      if (!isNaN(d)) map.set(d.getMonth(), (map.get(d.getMonth())||0) + Number(r.amount||0))
    })
    return months.map((_,i)=> map.get(i))
  }
  const incSeries = byMonth(income, 'income')
  const expSeries = byMonth(bills, 'bills')
  const maxBar = Math.max(...incSeries, ...expSeries, 1)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPI title="Total Income" value={currency(totalIncome)} />
        <KPI title="Total Expenses" value={currency(totalExpenses)} />
        <KPI title="Net" value={currency(net)} positive={net>=0} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Income by Month"><MiniBars labels={months} values={incSeries} max={maxBar} color="bg-emerald-600" /></Card>
        <Card title="Expenses by Month"><MiniBars labels={months} values={expSeries} max={maxBar} color="bg-rose-600" /></Card>
      </div>
    </div>
  )
}
function KPI({ title, value, positive }){ return (<div className="bg-white rounded-2xl shadow-sm p-4"><div className="text-sm text-stone-500">{title}</div><div className={`text-3xl font-semibold ${positive?'text-emerald-700':''}`}>{value}</div></div>) }
function Card({ title, children }){ return (<div className="bg-white rounded-2xl shadow-sm p-4"><div className="text-base font-semibold mb-2">{title}</div>{children}</div>) }
function MiniBars({ labels, values, max, color}){ return (<div className="grid grid-cols-12 gap-2 items-end min-h-[140px]">{values.map((v,i)=>(<div key={i} className="flex flex-col items-center gap-1"><div className={`w-full rounded-t-lg ${color}`} style={{height:`${Math.max(6,(v/max)*120)}px`}}></div><span className="text-[10px] text-stone-500">{labels[i]}</span></div>))}</div>) }

function CategoriesPage({ rows, setRows }){ return (<TablePage title="Categories" rows={rows} setRows={setRows} columns={[{key:'name',label:'Name'},{key:'type',label:'Type'}]} filters={[...new Set(rows.map(r=> r.type))]} pillField="type" />) }
function IncomePage({ rows, setRows }){ return (<TablePage title="Income" rows={rows} setRows={setRows} columns={[{key:'date',label:'Date'},{key:'source',label:'Source'},{key:'amount',label:'Amount',type:'number',render:(v)=> currency(Number(v))},{key:'tags',label:'Tags',render:(v=[])=> <div className='flex gap-1 flex-wrap'>{(v||[]).map((t,i)=> <span key={i} className='px-2 py-0.5 bg-stone-200 rounded-full text-xs'>{t}</span>)}</div>}]} filters={[...new Set(rows.flatMap(r=> r.tags||[]))]} pillField="tags" />) }
function BillsPage({ rows, setRows }){ return (<TablePage title="Bills" rows={rows} setRows={setRows} columns={[{key:'due',label:'Due Date'},{key:'name',label:'Bill'},{key:'category',label:'Category'},{key:'amount',label:'Amount',type:'number',render:(v)=> currency(Number(v))},{key:'status',label:'Status'}]} filters={[...new Set(rows.map(r=> r.status))]} pillField="status" />) }

function TablePage({ title, columns, rows, setRows, filters=[], pillField }){
  const [sort, setSort] = useState({ key: columns[0].key, dir: 'asc' })
  const [active, setActive] = useState('all')
  const sorted = useMemo(()=> [...rows].sort((a,b)=> sort.dir==='asc' ? (a[sort.key]>b[sort.key]?1:-1) : (a[sort.key]<b[sort.key]?1:-1)), [rows, sort])
  const filtered = useMemo(()=> {
    if (!pillField || active==='all') return sorted
    return sorted.filter(r => {
      const val = r[pillField]
      if (Array.isArray(val)) return val.map(String).includes(String(active))
      return String(val) === String(active)
    })
  }, [sorted, active, pillField])
  const [form, setForm] = useState(Object.fromEntries(columns.map(c=> [c.key, ''])))
  const addRow = () => { setRows(prev=> [...prev, { id: crypto.randomUUID(), ...form }]); setForm(Object.fromEntries(columns.map(c=> [c.key, '']))) }
  const remove = (id) => setRows(prev => prev.filter(r => r.id !== id))
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><h2 className="text-xl font-semibold">{title}</h2></div>
      {filters.length>0 && (<div className="flex flex-wrap gap-2"><button className={`px-2 py-1 rounded-full text-xs ${active==='all'?'bg-stone-800 text-white':'bg-stone-200'}`} onClick={()=> setActive('all')}>All</button>{filters.map((f,i)=> (<button key={i} className={`px-2 py-1 rounded-full text-xs ${active===f?'bg-stone-800 text-white':'bg-stone-200'}`} onClick={()=> setActive(f)}>{f}</button>))}</div>)}
      <div className="overflow-x-auto bg-white rounded-2xl shadow-sm">
        <table className="w-full text-sm"><thead><tr className="text-left text-stone-500">
          {columns.map(col => (<th key={col.key} className="py-2 px-3 cursor-pointer" onClick={()=> setSort(s=> ({ key: col.key, dir: s.dir==='asc'?'desc':'asc' }))}>{col.label}</th>))}
          <th className="py-2 px-3">Actions</th></tr></thead>
          <tbody>
            {filtered.map(row => (<tr key={row.id} className="border-t border-stone-200">
              {columns.map(col => (<td key={col.key} className="py-2 px-3 whitespace-nowrap">{col.render? col.render(row[col.key], row) : String(row[col.key] ?? '')}</td>))}
              <td className="py-2 px-3"><button className="text-rose-600 hover:underline" onClick={()=> remove(row.id)}>Delete</button></td></tr>))}
          </tbody>
        </table>
      </div>
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <div className="font-medium mb-2">Add New</div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
          {columns.map(col => (<input key={col.key} className="px-3 py-2 rounded-lg bg-stone-100 text-sm" placeholder={col.label} type={col.type==='number'?'number':'text'} value={form[col.key]} onChange={(e)=> setForm(f=> ({...f, [col.key]: col.type==='number'? Number(e.target.value) : e.target.value}))}/>))}
        </div>
        <div className="pt-2"><button className="px-3 py-2 rounded-lg bg-stone-800 text-white text-sm" onClick={addRow}>Add</button></div>
      </div>
    </div>
  )
}
