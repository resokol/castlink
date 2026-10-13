import {createHash} from 'node:crypto';

// Shared existing seed writes. Caller supplies its transaction and guards scope.
export async function seedDefaultTransaction(client,config,currentRooms) {
  const {organizationId,studioId,accountId,nodeId,nodeName,nodeType,nodeRegion}=config;
  const roomId=name=>'room-'+createHash('sha256').update(`${organizationId}/${studioId}/${name}`).digest('hex').slice(0,24);
    await client.query(
      `INSERT INTO castlink_control.accounts(account_id, display_name)
       VALUES ($1,$2)
       ON CONFLICT (account_id) DO UPDATE SET display_name=EXCLUDED.display_name`,
      [accountId, "CastLink Owner"],
    );
    await client.query(
      `INSERT INTO castlink_control.organizations(organization_id,name)
       VALUES ($1,$2)
       ON CONFLICT (organization_id) DO NOTHING`,
      [organizationId, "Default Organization"],
    );
    await client.query(
      `INSERT INTO castlink_control.organization_members(organization_id,account_id,role)
       VALUES ($1,$2,'owner')
       ON CONFLICT (organization_id,account_id) DO UPDATE SET role='owner'`,
      [organizationId, accountId],
    );
    await client.query(
      `INSERT INTO castlink_control.nodes(node_id,name,region,node_type,health,last_seen_at)
       VALUES ($1,$2,$3,$4,'unknown',NULL)
       ON CONFLICT (node_id) DO UPDATE SET name=EXCLUDED.name,region=EXCLUDED.region,updated_at=now()`,
      [nodeId, nodeName, nodeRegion, nodeType],
    );
    await client.query(
      `INSERT INTO castlink_control.studios(studio_id,organization_id,name,assignment_mode,assigned_node_id)
       VALUES ($1,$2,$3,'pinned',$4)
       ON CONFLICT (studio_id) DO UPDATE SET organization_id=EXCLUDED.organization_id,assigned_node_id=EXCLUDED.assigned_node_id,updated_at=now()`,
      [studioId, organizationId, "Default Studio", nodeId],
    );

    for (const room of currentRooms.rows) {
      await client.query(
        `INSERT INTO castlink_control.rooms(room_id,studio_id,name,settings)
         VALUES ($1,$2,$3,$4::jsonb)
         ON CONFLICT (studio_id,name) DO UPDATE SET settings=EXCLUDED.settings,updated_at=now()`,
        [roomId(room.name), studioId, room.name, JSON.stringify({ studioOnly: room.studio_only === true })],
      );
    }

}
