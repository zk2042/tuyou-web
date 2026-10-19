export function getEditorialKey(imageUrl: string): string | undefined {
  const match = String(imageUrl || '').match(/^(?:https:\/\/tuyou\.evenstar\.love)?\/editorial\/([a-z0-9-]+)\.jpg(?:[?#].*)?$/i)
  return match?.[1]
}
