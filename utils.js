/**
 * Return a union of several arrays.
 * @param arr {*[]} - Arrays to merge.
 * @returns {*|*[]} - A union of all of the arrays given.
 */

const union = (...arr) => {
  return [ ...new Set(arr.reduce((acc, val) => [ ...acc, ...val ])) ]
}

module.exports = {
  union
}
