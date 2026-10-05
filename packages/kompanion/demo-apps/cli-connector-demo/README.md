# cli-connector-demo

A Camel Main app with `camel-cli-connector`, to try the Kompanion by hand: two routes, `heartbeat`
(a timer, every 2 seconds) and `orders` (`direct:orders`; the header `fail=true` makes it fail).

```bash
./build.sh                    # builds it on Camel 4.18.4, 4.22.1 and 4.23.0-SNAPSHOT
./build.sh 4.22.1             # or on one version
```

Each version is in `target/<camel.version>/` (classes and `lib/`). Run it with:

```bash
# file transport (every Camel version): the Kompanion finds it as pid-<pid>
java -cp "target/4.22.1/classes:target/4.22.1/lib/*" org.apache.camel.main.Main

# WebSocket transport (Camel 4.23+): it connects to the Kompanion
java -Dcamel.cli.transport=websocket \
     -Dcamel.cli.websocket.url="ws://127.0.0.1:<kompanion port>/v1/worker/connect?executionId=demo-4.23" \
     -cp "target/4.23.0-SNAPSHOT/classes:target/4.23.0-SNAPSHOT/lib/*" org.apache.camel.main.Main
```

The Kaoto VS Code extension launches them for you (`Kaoto Kompanion: Launch Demo App`).
