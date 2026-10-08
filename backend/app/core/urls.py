"""URL safety helpers to block private or local network targets (SSRF protection)."""
from __future__ import annotations

import ipaddress
import socket
from typing import Optional
from urllib.parse import urlparse


def _is_private_ipv4(ip_str: str) -> bool:
    try:
        addr = ipaddress.IPv4Address(ip_str)
    except ValueError:
        return False
    for network in (
        "127.0.0.0/8",
        "10.0.0.0/8",
        "172.16.0.0/12",
        "192.168.0.0/16",
        "169.254.0.0/16",
    ):
        if addr in ipaddress.IPv4Network(network):
            return True
    return False


def _is_private_ipv6(ip_str: str) -> bool:
    try:
        addr = ipaddress.IPv6Address(ip_str)
    except ValueError:
        return False
    for network in ("::1/128", "fe80::/10", "fc00::/7"):
        if addr in ipaddress.IPv6Network(network):
            return True
    return False


def _resolve_host_to_ips(host: str) -> list[str]:
    try:
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror:
        return []
    ips: set[str] = set()
    for family, _socktype, _proto, _canonname, sockaddr in infos:
        if sockaddr:
            ips.add(sockaddr[0])
    return list(ips)


def is_url_safe(url: str) -> bool:
    """Return False if URL targets localhost, private nets, or link-local ranges."""
    try:
        parsed = urlparse(url)
    except Exception:
        return False
    if not parsed.scheme or parsed.scheme.lower() not in {"http", "https"}:
        return False
    netloc_raw = (parsed.netloc or "").strip()
    if not netloc_raw:
        return False
    host = netloc_raw
    if ":" in host and "[" not in host:
        host = host.rsplit(":", 1)[0]
    elif host.startswith("["):
        end = host.find("]")
        if end != -1:
            host = host[1:end]
    host_lower = host.lower()
    if host_lower == "localhost":
        return False
    if host_lower.endswith(".local"):
        return False
    if host_lower.endswith(".localhost"):
        return False
    try:
        if _is_private_ipv4(host):
            return False
    except Exception:
        pass
    try:
        if _is_private_ipv6(host):
            return False
    except Exception:
        pass
    ips = _resolve_host_to_ips(host)
    for ip in ips:
        if _is_private_ipv4(ip):
            return False
        if _is_private_ipv6(ip):
            return False
    return True
