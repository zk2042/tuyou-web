import credits from '../../public/editorial/credits.json'

type PhotoCredit = (typeof credits)[number]

const creditByKey = new Map<string, PhotoCredit>(credits.map(credit => [credit.key, credit]))

export function getEditorialCredit(imageUrl: string): PhotoCredit | undefined {
  const match = String(imageUrl || '').match(/^(?:https:\/\/tuyou\.evenstar\.love)?\/editorial\/([a-z0-9-]+)\.jpg(?:[?#].*)?$/i)
  return match ? creditByKey.get(match[1]) : undefined
}

export function stripEditorialAttribution(content: string | null | undefined, images?: string[]): string {
  const raw = String(content || '').replace(/\r\n?/g, '\n')
  const credit = images?.map(getEditorialCredit).find(Boolean)
  if (!credit) return raw

  const footer = `\n\n配图：${credit.author}，Wikimedia Commons，[原图](${credit.source})，许可：[${credit.license}](${credit.licenseUrl})。`
  const trimmed = raw.trimEnd()
  return trimmed.endsWith(footer) ? trimmed.slice(0, -footer.length) : raw
}
