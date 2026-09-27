import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../../../',import.meta.url));
const server=await createServer({configFile:false,root,resolve:{alias:{'@':fileURLToPath(new URL('../../../../src',import.meta.url))}},server:{host:'127.0.0.1',port:5214,strictPort:true}});
await server.listen();server.printUrls();
