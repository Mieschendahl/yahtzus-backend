export { Socket } from "socket.io";
import { MersenneTwister19937, Random } from "random-js";

export let random = new Random(MersenneTwister19937.autoSeed());

export function setRandomSeed(seed: number): void {
  random = new Random(MersenneTwister19937.seed(seed));
}

export function findMin<T>(
  items: T[],
  valueFn: (item: T) => number
): T[] {
  if (items.length === 0) return []

  let minValue = valueFn(items[0])
  let result: T[] = [items[0]]

  for (let i = 1; i < items.length; i++) {
    const item = items[i]
    const value = valueFn(item)

    if (value < minValue) {
      minValue = value
      result = [item]
    } else if (value === minValue) {
      result.push(item)
    }
  }

  return result
}