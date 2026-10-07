// What the receiver's tests share: a ComposableFix project in a temporary folder, a free port for
// the hub, and requests as the app and the hooks send them.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

/** A folder holding `android/`, a Gradle build whose app `com.example.shop` uses ComposableFix. */
export function project() {
  const root = mkdtempSync(join(tmpdir(), 'composablefix-'))
  const write = (path, text = '') => {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), text)
  }
  write('android/settings.gradle.kts', 'rootProject.name = "shop"\ninclude(":app")\n')
  write(
    'android/app/build.gradle.kts',
    'android {\n  namespace = "com.example.shop"\n  defaultConfig { applicationId = "com.example.shop" }\n}\n' +
      'dependencies {\n  debugImplementation("dev.composablefix:composablefix:0.1.0")\n}\n',
  )
  write('android/app/src/main/kotlin/com/example/shop/Card.kt')
  return { root, android: join(root, 'android'), remove: () => rmSync(root, { recursive: true, force: true }) }
}

/** A port nothing listens on. */
export function freePort() {
  return new Promise(resolve => {
    const server = createServer()
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      server.close(() => resolve(port))
    })
  })
}

export async function call(port, method, path, body) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  })
  return response.json()
}

/** A report as the app sends it, with no screenshot. */
export const report = (comment, element) => ({
  comment,
  screen: 'Home',
  touch: { x: 10, y: 10 },
  density: 2,
  android: { package: 'com.example.shop', pid: 1, component: 'com.example.shop/.MainActivity' },
  ...(element ? { element } : {}),
})

export const until = async (done, ms = 3_000) => {
  for (let waited = 0; !(await done()); waited += 20) {
    if (waited > ms) throw new Error('it never got there')
    await new Promise(resolve => setTimeout(resolve, 20))
  }
}
