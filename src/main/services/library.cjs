const fs = require('node:fs/promises');
const path = require('node:path');
function createLibraryStore(file) {
  let writes = Promise.resolve();
  return {
    async read() {
      await writes;
      try {
        const value = JSON.parse(await fs.readFile(file, 'utf8'));
        if (value.version !== 1 || !Array.isArray(value.items)) throw Error('曲库格式无效');
        return value;
      } catch (error) {
        if (error.code === 'ENOENT') return null;
        throw error;
      }
    },
    write(value) {
      if (value?.version !== 1 || !Array.isArray(value.items)) throw Error('曲库格式无效');
      const data = JSON.stringify(value);
      const next = writes
        .catch(() => {})
        .then(async () => {
          await fs.mkdir(path.dirname(file), { recursive: true });
          await fs.writeFile(file + '.tmp', data, 'utf8');
          await fs.rename(file + '.tmp', file);
        });
      writes = next;
      return next;
    },
  };
}
module.exports = { createLibraryStore };
