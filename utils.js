/**
 * Return a union of two or more arrays.
 * @param arr {*[]} - Arrays to merge.
 * @returns {*[]} - A union of all of the arrays given.
 */

const union = (...arr) => {
  return [ ...new Set(arr.reduce((acc, val) => [ ...acc, ...val ])) ]
}

/**
 * Returns an intersection of two or more arrays.
 * @param arr {*[]} - Arrays to find the intersection of.
 * @returns {*[]} - The intersection of all the arrays given.
 */

const intersection = (...arr) => {
  let intersection = arr[0]
  for (let i = 1; i < arr.length; i++) {
    intersection = intersection.filter(x => arr[i].includes(x))
  }
  return intersection
}

module.exports = {
  union,
  intersection
}
