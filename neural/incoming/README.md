# Drop the Neural Graph source export here

I can't pull the wormhole.app transfer directly — it's end-to-end encrypted with the
key in the URL fragment (`#…`), which never reaches the server, so it only decrypts in
your browser. You're on this machine, so the handoff is one step:

1. Open the wormhole link in your browser and download the file.
2. Save/move it into THIS folder: `neural/incoming/`  (a .zip, the .dc.html, whatever it is).
3. Tell me "dropped" (or the filename).

I'll then unzip/read the complete source, precompile it (esbuild + preact/compat +
DCLogic shim), wire it to the data bridge, and continue the epic autonomously.

Alternatively run it yourself in the session:  `! mv ~/Downloads/<file> neural/incoming/`
