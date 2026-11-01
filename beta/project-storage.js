/* Main and preview pages share an origin. Prefix every project record with
   the installation directory, including records used only by Undo or recovery. */
window.ProjectStorage = (() => {
  const prefix = 'pvs@' + new URL('./', location.href).pathname + '|';
  const key = name => prefix + name;

  // Copy old records only once. One read/write transaction protects both the
  // source snapshot and the destination from concurrent saves and partial copies.
  function migrate(db, storeName, roots, dependencies) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const seen = new Set();
      let first = false, failure;
      function copy(name) {
        if (seen.has(name)) return;
        seen.add(name);
        const read = store.get(name);
        read.onsuccess = () => {
          if (read.result == null) return;
          try {
            if (!first) { store.put(true, key('initialized')); first=true; }
            store.put(read.result, key(name));
            if (dependencies) for (const ref of dependencies(name, read.result)) copy(ref);
          } catch (error) {
            failure = error;
            tx.abort();
          }
        };
      }
      const marker = store.getKey(key('initialized'));
      marker.onsuccess = () => {
        if (marker.result !== undefined) return;
        for (const name of roots) copy(name);
      };
      tx.oncomplete = () => resolve(first);
      tx.onabort = () => reject(failure || tx.error || new Error('The autosave upgrade was interrupted.'));
    });
  }
  return { prefix, key, migrate };
})();
