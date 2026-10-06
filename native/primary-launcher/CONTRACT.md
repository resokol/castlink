# Primary Windows launcher source boundary

Baseline 432ab60. Initial image must already be authenticated by the distribution/installation trust boundary. Its self hash is not that authority. No full same-SID process isolation or protection against pre-existing writable mappings is claimed.

The primary image resolves SystemDirectory in-process and admits only an embedded, finite package inventory. It opens every replaceable ancestor and package member without WRITE/DELETE sharing, rejects reparse points and ambiguous names, checks owner/DACL and stable held-handle identity, hashes held bytes, and spawns explicit Node only after complete admission. Guard handles are inherited through HANDLE_LIST and remain live in Node if the launcher crashes. Windows directory-share semantics and actual Node startup lifetime require later native acceptance.

Fixed bootstrap context is an inherited read-only channel, never environment/PATH authority. A payload alone is not proof of its native origin. The accepted channel ruling places authenticity in native CreateProcess/handle ownership, not stock JS origin detection. Ordinary direct Node without capabilities refuses. Deliberately forged standalone Node pipes are outside this authenticated initial-image flow; no cryptographic authentication is claimed.

Implementation order: deterministic real C core RED/GREEN (SHA, quoting, guard admission/transfer/lifetime); Win32 adapter; embedded inventory generator; private CI compile/import/observed-toolchain receipt. No native acceptance execution or publication in this source slice. At runtime the primary broker alone launches fixed OS PowerShell catalog operations; no secondary resolver EXE/addon or caller-selected script/executable authority.
