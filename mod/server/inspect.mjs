// Tells which element a report's touch landed on, from the screen's accessibility tree as
// android.mjs reads it. The app needs no marks for this: Compose exposes every text, image and
// control to accessibility. No dependencies.

const contains = (frame, { x, y }) =>
  frame != null && x >= frame.x && x <= frame.x + frame.width && y >= frame.y && y <= frame.y + frame.height

const isNamed = node => Boolean(node.label || node.value || node.identifier)
// ComposableFix's own views (a banner, the composer) are never what was pressed.
const isOwnView = node => node.identifier?.startsWith('composablefix.') === true

const summary = ({ type, label, value, identifier }) => ({ type, label, value, identifier })

/** Every named element under `node`, itself left out. */
function namedBelow(node) {
  return (node.children ?? [])
    .filter(child => !isOwnView(child))
    .flatMap(child => [...(isNamed(child) ? [child] : []), ...namedBelow(child)])
}

/**
 * The element a touch landed on, the named element it sits in, and the labels beside it.
 *
 * The element is the deepest named element whose frame holds the point (the smaller one when two
 * are as deep). `within` is its nearest named ancestor: the button around an icon, say. Beside it
 * are the other named elements under the same parent that share its row, `slop` pixels above or
 * below it at most (the receiver passes 12dp), nearest first, up to six.
 */
export function elementAt(tree, point, { slop = 12 } = {}) {
  let best = null
  const visit = (node, ancestors) => {
    if (isOwnView(node) || !contains(node.frame, point)) return
    if (isNamed(node)) {
      const area = node.frame.width * node.frame.height
      const depth = ancestors.length
      if (best === null || depth > best.depth || (depth === best.depth && area < best.area)) {
        best = { node, depth, area, ancestors }
      }
    }
    for (const child of node.children ?? []) visit(child, [...ancestors, node])
  }
  for (const root of tree) visit(root, [])
  if (best === null) return null

  const parent = best.ancestors.at(-1) ?? { children: [] }
  const within = best.ancestors.findLast(isNamed)

  const { frame } = best.node
  const top = frame.y - slop
  const bottom = frame.y + frame.height + slop
  const centre = node => ({ x: node.frame.x + node.frame.width / 2, y: node.frame.y + node.frame.height / 2 })
  const distance = node => Math.hypot(centre(node).x - point.x, centre(node).y - point.y)
  const labels = new Set(
    namedBelow(parent)
      .filter(node => node.label && node.frame && node.frame.y < bottom && node.frame.y + node.frame.height > top)
      .sort((a, b) => distance(a) - distance(b))
      .map(node => node.label),
  )
  labels.delete(best.node.label)
  const nearby = [...labels].slice(0, 6)

  return { element: summary(best.node), within: within ? summary(within) : null, nearby }
}
