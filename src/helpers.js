/**
 * Helper method to load state
 *
 * @param {*} $localStorageKey
 * @param {*} $store (Store or Component)
 * @param {*} $default
 */
export function loadStates(){}
// export function loadStates(
//   $localStorageKey,
//   $store,
//   $default,
//   isComponent = true
// ) {
//   // Set default
//   const $q = useQuasar();
//   $default = $q.localStorage.getItem($localStorageKey) || $default;

//   if (isComponent) {
//     // Map keys
//     Object.keys($store.$options.data()).forEach((key) => {
//       $store[key] = $default[key];
//     });
//   } else {
//     // Map keys
//     Object.keys($store.$state).forEach((key) => {
//       $store.$state[key] = $default[key];
//     });

//     // Autosave
//     $store.$subscribe(() => {
//       $q.localStorage.set($localStorageKey, $store.$state);
//     });
// //   }
// }
