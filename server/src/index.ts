import dotenv from 'dotenv';

dotenv.config();

const [{ createApp }, { env }] = await Promise.all([import('./app.js'), import('./config/env.js')]);

createApp().listen(env.PORT, () => {
  console.log(`server listening on http://localhost:${env.PORT}`);
});
