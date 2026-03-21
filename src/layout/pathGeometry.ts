export interface Point {
  x: number
  y: number
}

function formatCoordinate(value: number) {
  return Number.isInteger(value) ? `${value}` : `${Number(value.toFixed(2))}`
}

function formatPoint(entry: Point) {
  return `${formatCoordinate(entry.x)} ${formatCoordinate(entry.y)}`
}

function segmentLength(start: Point, end: Point) {
  return Math.abs(start.x - end.x) + Math.abs(start.y - end.y)
}

function isColinear(start: Point, middle: Point, end: Point) {
  return (start.x === middle.x && middle.x === end.x) || (start.y === middle.y && middle.y === end.y)
}

function moveToward(start: Point, target: Point, distance: number): Point {
  if (start.x === target.x) {
    return {
      x: start.x,
      y: start.y + Math.sign(target.y - start.y) * distance,
    }
  }

  return {
    x: start.x + Math.sign(target.x - start.x) * distance,
    y: start.y,
  }
}

export function compactOrthogonalPoints(points: Point[]): Point[] {
  return points.filter((entry, index) => {
    if (index === 0) {
      return true
    }

    const previous = points[index - 1]
    return previous.x !== entry.x || previous.y !== entry.y
  })
}

export function smoothOrthogonalPath(points: Point[], radius = 14): string {
  if (points.length === 0) {
    return ''
  }

  if (points.length === 1) {
    return `M ${formatPoint(points[0])}`
  }

  const commands = [`M ${formatPoint(points[0])}`]

  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1]
    const current = points[index]
    const next = points[index + 1]

    const incomingLength = segmentLength(previous, current)
    const outgoingLength = segmentLength(current, next)
    const cornerRadius = Math.min(radius, incomingLength / 2, outgoingLength / 2)

    if (
      incomingLength === 0 ||
      outgoingLength === 0 ||
      cornerRadius < 1.0 ||
      isColinear(previous, current, next)
    ) {
      commands.push(`L ${formatPoint(current)}`)
      continue
    }

    const entry = moveToward(current, previous, cornerRadius)
    const exit = moveToward(current, next, cornerRadius)

    commands.push(`L ${formatPoint(entry)}`)
    commands.push(`Q ${formatPoint(current)} ${formatPoint(exit)}`)
  }

  commands.push(`L ${formatPoint(points[points.length - 1])}`)
  return commands.join(' ')
}
