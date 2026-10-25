# Windows named-volume adapter: source contract

Отдельный manifest2 capability `castlink-idleseal-private-volume-v1` требует
`1.13.7+castlink-idleseal-private.3` и `castlink-private-volume-v1`.
Четыре сервисa сохраняются; только этот capability добавляет пятый management
volume `castlink-<installationId без дефисов>_private_control`. Schema1 сохраняет
прежние четыре volume и CONFIG bytes. Windows SID/DACL защищает host CONFIG и
cursor; guest UID/GID/mode/inode доказываются отдельным `.3` metadata protocol.

CONFIG сохраняет физический host root, engine/endpoint/SID/scope, immutable
capability receipt и fingerprints в private reservation. CONFIG не заявляет,
что guest storage уже создан. SERVICES держит тот же target lease, сохраняет
durable bootstrap attempt, создаёт отдельный volume, ROOT-only provisioning
helper резервирует EMPTY 0600 guest inode до CREATE четырёх сервисов. Bind
проходит через тот же inode со full actual LiveKit CID и secret только через
stdin; initialize и metadata подтверждают исходную reservation/binding.
Все временные helper containers создаются с immutable image ID и
`--pull=never`, no-copy volume, network none и readonly rootfs; metadata mount
readonly. Неопределённый результат сохраняет attempt/CID/lease, без repair.

Первый start сначала запускает PostgreSQL, затем CLOSED LiveKit; actual guest
binary/version/hash, metadata и CLOSED process nonce проверяются до web/Caddy.
Повторный START завершённой установки использует только readonly metadata
helper и исходные CONFIG/resource/CID/inode association: reserve/bind/init и
CREATE повторно не выполняются. SQL, owner completion и admission READY этим
протоколом не устанавливаются.

Docker Desktop mount source допускает только три конечных canonical drive
представления. Остановленный CID даёт лишь deferred mapping; окончательная
проверка читает applied bind из running CLOSED LiveKit и сравнивает bounded
archive SHA256 с исходным защищённым CONFIG файлом. Archive и credential bytes
не выходят через Executor stdout: наружу возвращаются только hashes/metadata.
Readonly status повторяет authority, physical CONFIG и retained resource
identity; capability scope переносится из исходного cursor в input/receipt.

`privateVolumeArtifact` намеренно NULL. Manifest/caller не может заменить его.
SERVICES/START и guest observer отказывают до executor без reviewed imageID и
binarySHA256. Полная `.3` сборка, Windows Docker Desktop CREATE/volume/inode
семантика, native DACL fixtures и functional four-stack acceptance ещё
UNVERIFIED. Backup/update/restore/uninstall schema2 management-volume consumers остаются
отдельной несовместимой границей: существующие hardcoded-four guards должны
явно эволюционировать перед их использованием; нельзя пропускать или откатывать
management state/epochs. Legacy receipt нельзя переписывать в новый capability.


Immutable lifecycle associations сравниваются отдельно от cursor receipt. После успешного эффекта cursor сохраняет все associations, `uncertain:false` и ровно E→E+1; проверки CONFIG/profile/resource продолжают действовать. `wvTransient` проверяет выбранный engine непосредственно перед CREATE, включая metadata helper.
