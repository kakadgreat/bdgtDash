export async function fetchSheetCSV(url){
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error('Failed to fetch sheet CSV')
  return await res.text()
}