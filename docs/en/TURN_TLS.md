[Русский](../../TURN_TLS.md) · **English** · [简体中文](../zh-CN/TURN_TLS.md)

# TURN over TLS on TCP 443

TURN/TLS helps casters connect from networks that block UDP. It carries media to the relay over an encrypted TCP connection. It is not a VPN and cannot guarantee access through every corporate filter.

## Requirements

- A publicly reachable VPS running CastLink, with administrative access.
- Two different domains, such as `studio.example.org` for the website and `relay.example.org` for TURN. Replace the examples with your own names.
- A records pointing both names to the VPS public IPv4. Use DNS-only mode if your DNS proxy does not support TURN. Do not publish an AAAA record without a working IPv6 route.
- Inbound TCP 80 and TCP 443 on the VPS. The standard configuration uses TCP 80 for automatic certificate issuance and renewal; keep it open after installation.
- Outbound HTTPS from the server to package sources and the certificate service, plus DNS access.

The caster’s network must allow TURN/TLS to the TURN domain on TCP 443. Browser HTTPS access through a proxy alone may not be sufficient. The network administrator may need to allow this transport and exempt it from TLS interception.

## New installation with Easy Setup

1. Create both DNS records, wait for propagation and verify that both names resolve to the correct VPS.
2. Open Easy Setup on Windows, select **Install → External server** and enter the SSH settings. Verify the server host-key fingerprint against your provider’s information.
3. Enter `studio.example.org` as the website address, without `https://` or a path. This scenario requires a website domain, not just an IP.
4. When prompted for the separate TURN/TLS domain, enter `relay.example.org`. Leaving it blank keeps ordinary TURN/UDP.
5. Wait for installation and the certificate/TURN-TLS route check to finish. Keep the wizard’s working folder and the installation path on the VPS.
6. Perform the media check below. A successful installation message does not replace it.

If the wizard reports that TURN/TLS is not ready, check DNS, TCP 80/443 and conflicting services on those ports. Fix the cause and retry the unfinished installation in the same folder.

## Existing installations

**TURN/TLS was already enabled:** check DNS, TCP 443 and the certificate, then test media. Reinstallation is unnecessary.

**The server only uses TURN/UDP:** opening TCP 443 alone does not enable TURN/TLS. Certificates, the HTTPS proxy and the media server must be configured together. On subsequent runs, the wizard preserves the saved TURN domain and may not prompt for a new one.

Do not start a new installation over a working server just to add TURN. Back up its data and configuration and schedule downtime. For an existing-installation conversion, [contact the author](https://t.me/sklvmax) with your CastLink version and installation method. Do not include passwords or private keys.

This guide covers a standard new VPS installation through the wizard. It is not an in-place TURN/TLS conversion procedure for a local Windows server or Linux installed using the separate guide without Easy Setup. Do not copy arbitrary settings from another installation.

## Ports to retain

| Purpose | Rule |
| --- | --- |
| TURN/TLS and HTTPS | Inbound TCP 443 on the VPS; outbound TCP 443 for the caster |
| Automatic certificates in the standard configuration | Inbound TCP 80 on the VPS |
| Direct media and TURN/UDP | Retain the media ports in the [main guide](GUIDE.md) |

TURN/TLS changes the transport between the caster and the relay. It does not eliminate the server’s UDP relay ports. The wizard configures HTTPS and TURN/TLS routing on the same IP:443; a second independent listener on that port would conflict. Internal service ports do not need public exposure.

## Verification

1. Open a studio and invite a caster from a second device on an external network.
2. In the studio, select **Caster route → Backup TURN** for that caster and wait for reconnection confirmation. The enclosing section name may vary by version.
3. Check the caster’s video/audio and the studio return stream. To test TCP/TLS specifically, repeat from a network where UDP is unavailable but TURN/TLS on TCP 443 is allowed.
4. For technical confirmation, check WebRTC statistics for a selected `relay` candidate and TURN server `turns:relay.example.org:443?transport=tcp`. Field presentation varies by browser. A `relay` candidate alone does not distinguish TURN/UDP from TURN/TLS.

Casters do not enter separate TURN credentials: CastLink obtains the connection settings automatically.

## Troubleshooting

- **No certificate:** check both DNS records, TCP 80 reachability and domain certificate-issuance policies.
- **Website works but TURN does not:** check whether the caster’s network allows TURN/TLS. HTTPS reachability does not prove TURN reachability.
- **Forced TURN carries no media:** check TURN status, server relay ports and return traffic.
- **It stopped working later:** check certificate expiry, DNS and automatic renewal access.

[Main guide](GUIDE.md) · [Linux installation](LINUX_INSTALL.md) · [Ask a question](https://t.me/sklvmax)
