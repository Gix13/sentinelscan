"""
Shared feature extractors for both ML models.

- extract_url_features(url): produces the same numeric features that PhiUSIIL
  uses, computable from a raw URL string at inference time.
- extract_network_features(ports): produces a NSL-KDD compatible feature vector
  (subset that we can derive from Nmap output) for a host.
"""

import re
from urllib.parse import urlparse


# ============================================================================
# URL feature extraction (PhiUSIIL-compatible subset)
# ============================================================================

# We use the subset of PhiUSIIL features that can be computed from URL alone
# (no need to fetch the page content). 23 features total.
URL_FEATURE_NAMES = [
    "URLLength",
    "DomainLength",
    "IsDomainIP",
    "TLDLength",
    "NoOfSubDomain",
    "NoOfLettersInURL",
    "LetterRatioInURL",
    "NoOfDegitsInURL",
    "DegitRatioInURL",
    "NoOfEqualsInURL",
    "NoOfQMarkInURL",
    "NoOfAmpersandInURL",
    "NoOfOtherSpecialCharsInURL",
    "SpacialCharRatioInURL",
    "IsHTTPS",
    "NoOfDots",
    "NoOfHyphens",
    "NoOfUnderscores",
    "NoOfSlashes",
    "NoOfPercents",
    "HasPort",
    "PathLength",
    "QueryLength",
]


def _is_ip(host):
    if not host:
        return 0
    return 1 if re.match(r"^(\d{1,3}\.){3}\d{1,3}$", host) else 0


def extract_url_features(url):
    """Return a dict of features keyed by URL_FEATURE_NAMES."""
    if not url:
        url = ""

    parsed = urlparse(url)
    scheme = parsed.scheme or ""
    host = parsed.hostname or ""
    port = parsed.port
    path = parsed.path or ""
    query = parsed.query or ""

    url_str = url
    url_length = len(url_str)
    domain_length = len(host)
    is_domain_ip = _is_ip(host)

    # TLD = last segment of host after last dot, if not an IP
    if is_domain_ip or "." not in host:
        tld_length = 0
        no_of_subdomain = 0
    else:
        parts = host.split(".")
        tld_length = len(parts[-1])
        # subdomains = parts before the registered domain (heuristic: parts - 2)
        no_of_subdomain = max(0, len(parts) - 2)

    # Character counts in entire URL
    no_letters = sum(1 for c in url_str if c.isalpha())
    no_digits = sum(1 for c in url_str if c.isdigit())
    letter_ratio = (no_letters / url_length) if url_length else 0.0
    digit_ratio = (no_digits / url_length) if url_length else 0.0

    no_eq = url_str.count("=")
    no_q = url_str.count("?")
    no_amp = url_str.count("&")
    special_chars_other = sum(1 for c in url_str if not c.isalnum() and c not in ".:/?=&_-%@")
    special_total = no_eq + no_q + no_amp + special_chars_other
    spacial_char_ratio = (special_total / url_length) if url_length else 0.0

    is_https = 1 if scheme == "https" else 0
    no_of_dots = url_str.count(".")
    no_of_hyphens = url_str.count("-")
    no_of_underscores = url_str.count("_")
    no_of_slashes = url_str.count("/")
    no_of_percents = url_str.count("%")
    has_port = 1 if port else 0
    path_length = len(path)
    query_length = len(query)

    return {
        "URLLength": url_length,
        "DomainLength": domain_length,
        "IsDomainIP": is_domain_ip,
        "TLDLength": tld_length,
        "NoOfSubDomain": no_of_subdomain,
        "NoOfLettersInURL": no_letters,
        "LetterRatioInURL": round(letter_ratio, 6),
        "NoOfDegitsInURL": no_digits,
        "DegitRatioInURL": round(digit_ratio, 6),
        "NoOfEqualsInURL": no_eq,
        "NoOfQMarkInURL": no_q,
        "NoOfAmpersandInURL": no_amp,
        "NoOfOtherSpecialCharsInURL": special_chars_other,
        "SpacialCharRatioInURL": round(spacial_char_ratio, 6),
        "IsHTTPS": is_https,
        "NoOfDots": no_of_dots,
        "NoOfHyphens": no_of_hyphens,
        "NoOfUnderscores": no_of_underscores,
        "NoOfSlashes": no_of_slashes,
        "NoOfPercents": no_of_percents,
        "HasPort": has_port,
        "PathLength": path_length,
        "QueryLength": query_length,
    }


# ============================================================================
# Network feature extraction (NSL-KDD-compatible subset)
# ============================================================================
#
# NSL-KDD has 41 features but most are connection-flow level (bytes, durations,
# error rates). From an Nmap scan we only get port numbers + service names.
# We extract the subset that's derivable from Nmap output:
#
#   - protocol_type (tcp/udp)
#   - service (mapped from port number / Nmap service name)
#   - flag (we set to "SF" since Nmap successful = "successful establishment")
#   - dst_host_count (total ports scanned on this host = always 1)
#   - dst_host_srv_count (count of services on this host)
#   - dst_host_same_srv_rate (1.0 since all to same target)
#   - dst_host_diff_srv_rate (number of unique services / total)
#
# We train models with these 7 features plus several aggregate features:
#   - num_ports, num_unique_services, num_tcp, num_udp, has_*_service flags

NETWORK_FEATURE_NAMES = [
    "duration",
    "src_bytes",
    "dst_bytes",
    "wrong_fragment",
    "urgent",
    "hot",
    "num_failed_logins",
    "logged_in",
    "num_compromised",
    "root_shell",
    "su_attempted",
    "num_root",
    "num_file_creations",
    "num_shells",
    "num_access_files",
    "num_outbound_cmds",
    "is_host_login",
    "is_guest_login",
    "count",
    "srv_count",
    "serror_rate",
    "srv_serror_rate",
    "rerror_rate",
    "srv_rerror_rate",
    "same_srv_rate",
    "diff_srv_rate",
    "srv_diff_host_rate",
    "dst_host_count",
    "dst_host_srv_count",
    "dst_host_same_srv_rate",
    "dst_host_diff_srv_rate",
    "dst_host_same_src_port_rate",
    "dst_host_srv_diff_host_rate",
    "dst_host_serror_rate",
    "dst_host_srv_serror_rate",
    "dst_host_rerror_rate",
    "dst_host_srv_rerror_rate",
    # Categorical (will be one-hot encoded during training)
    "protocol_type",
    "service",
    "flag",
]

# Categorical column names (need one-hot encoding)
NETWORK_CATEGORICAL = ["protocol_type", "service", "flag"]

# Map common port numbers to NSL-KDD service strings
PORT_TO_SERVICE = {
    21: "ftp", 22: "ssh", 23: "telnet", 25: "smtp", 53: "domain",
    69: "tftp_u", 70: "gopher", 79: "finger", 80: "http", 88: "klogin",
    102: "iso_tsap", 110: "pop_3", 111: "sunrpc", 113: "auth",
    119: "nntp", 123: "ntp_u", 135: "loc-srv", 137: "netbios_ns",
    139: "netbios_ssn", 143: "imap4", 161: "snmp", 179: "bgp",
    194: "IRC", 389: "ldap", 443: "http_443", 445: "netbios_ssn",
    465: "smtp", 514: "shell", 515: "printer", 530: "courier",
    540: "uucp", 543: "klogin", 544: "kshell", 587: "smtp",
    993: "imap4", 995: "pop_3", 1433: "sql_net", 1521: "sql_net",
    3306: "sql_net", 3389: "remote_job", 5432: "sql_net",
    5900: "X11", 6000: "X11", 6667: "IRC", 8080: "http_8001",
    8443: "http_443", 27017: "sql_net",
}


def _service_for_port(port_num, service_name=None):
    """Map a port (and optional Nmap-detected service name) to NSL-KDD service."""
    # Prefer Nmap-detected service when it matches NSL-KDD vocab
    if service_name:
        sn = service_name.lower().strip()
        # Common Nmap service names → NSL-KDD service
        nmap_to_nsl = {
            "ssh": "ssh", "http": "http", "https": "http_443",
            "ftp": "ftp", "telnet": "telnet", "smtp": "smtp",
            "domain": "domain", "pop3": "pop_3", "imap": "imap4",
            "ms-sql-s": "sql_net", "mysql": "sql_net",
            "postgresql": "sql_net", "mongodb": "sql_net",
            "ms-wbt-server": "remote_job", "rdp": "remote_job",
            "microsoft-ds": "netbios_ssn", "netbios-ssn": "netbios_ssn",
            "snmp": "snmp", "ntp": "ntp_u",
        }
        if sn in nmap_to_nsl:
            return nmap_to_nsl[sn]

    return PORT_TO_SERVICE.get(port_num, "other")


def extract_network_features(ports):
    """
    From a list of Nmap port objects, produce ONE row of NSL-KDD-style features
    representing the host's overall profile. Most NSL-KDD features (byte counts,
    durations, login attempts) are not derivable from Nmap, so they default to 0.

    Args:
        ports: list of dicts like { "port": 22, "service": "ssh", "protocol": "tcp" }

    Returns:
        dict keyed by NETWORK_FEATURE_NAMES
    """
    if not ports:
        ports = []

    num_ports = len(ports)
    services = [_service_for_port(p.get("port", 0), p.get("service")) for p in ports]
    protocols = [p.get("protocol", "tcp") for p in ports]
    unique_services = set(services)
    num_unique = len(unique_services)

    # Choose dominant protocol/service for the categorical fields
    primary_protocol = "tcp"
    if protocols.count("udp") > protocols.count("tcp"):
        primary_protocol = "udp"

    # Use the most "interesting" service if mixed (prefer non-http)
    primary_service = "other"
    if services:
        non_web = [s for s in services if s not in ("http", "http_443")]
        primary_service = non_web[0] if non_web else services[0]

    # Build the feature dict with defaults of 0 for fields we cannot derive.
    features = {name: 0 for name in NETWORK_FEATURE_NAMES if name not in NETWORK_CATEGORICAL}
    features["dst_host_count"] = min(255, num_ports)
    features["dst_host_srv_count"] = min(255, num_unique)
    features["same_srv_rate"] = 1.0 if num_ports > 0 and num_unique == 1 else 0.0
    features["diff_srv_rate"] = (num_unique / num_ports) if num_ports else 0.0
    features["dst_host_same_srv_rate"] = 1.0 if num_unique == 1 else (1.0 / num_unique if num_unique else 0.0)
    features["dst_host_diff_srv_rate"] = (num_unique / num_ports) if num_ports else 0.0
    features["srv_count"] = min(255, num_unique)
    features["count"] = min(255, num_ports)

    features["protocol_type"] = primary_protocol
    features["service"] = primary_service
    features["flag"] = "SF"  # Successful connection (Nmap got a response)

    return features


if __name__ == "__main__":
    # Quick smoke test
    import json

    print("URL features for https://example.com:")
    print(json.dumps(extract_url_features("https://example.com"), indent=2))

    print("\nNetwork features for [{port:22,ssh},{port:80,http}]:")
    print(json.dumps(extract_network_features([
        {"port": 22, "service": "ssh", "protocol": "tcp"},
        {"port": 80, "service": "http", "protocol": "tcp"},
    ]), indent=2))
