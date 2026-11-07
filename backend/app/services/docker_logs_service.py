"""
Serviço para leitura e monitoramento de logs dos contêineres Docker do projeto.
Utiliza comunicação direta via socket Unix (/var/run/docker.sock) sem necessidade de bibliotecas externas pesadas.
"""
import os
import re
import json
import time
import socket
from datetime import datetime
from zoneinfo import ZoneInfo
from typing import List, Dict, Any, Optional
from app.core.logger import logger

DOCKER_SOCKET_PATH = "/var/run/docker.sock"
BR_TIMEZONE = ZoneInfo("America/Sao_Paulo")

# Contêineres monitorados padrão do projeto
CONTAINER_SERVICES = {
    "backend": "nexus_chat_backend",
    "frontend": "nexus_chat_frontend",
}

# Cache de descoberta dinâmica de contêineres para suportar Portainer/Swarm
_CONTAINER_CACHE: Dict[str, Dict[str, Any]] = {}
_CACHE_TTL = 60  # segundos


def discover_container_target(service_name: str, force_refresh: bool = False) -> Optional[str]:
    """
    Descobre dinamicamente o ID ou nome do container no Docker socket.
    Suporta Docker Compose local, Portainer Stacks e Docker Swarm.
    """
    now = time.time()
    cached = _CONTAINER_CACHE.get(service_name)
    if not force_refresh and cached and (now - cached.get("timestamp", 0) < _CACHE_TTL):
        return cached.get("id")

    if not os.path.exists(DOCKER_SOCKET_PATH):
        return None

    try:
        sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        sock.settimeout(3.0)
        sock.connect(DOCKER_SOCKET_PATH)
        req = b"GET /containers/json?all=1 HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n"
        sock.sendall(req)
        raw_resp = b""
        while True:
            chunk = sock.recv(4096)
            if not chunk:
                break
            raw_resp += chunk
        sock.close()

        _, _, body = raw_resp.partition(b"\r\n\r\n")
        if b"\r\n" in body:
            line, rem = body.split(b"\r\n", 1)
            try:
                int(line, 16)
                body = rem
            except ValueError:
                pass

        clean_json = body.split(b"\r\n0\r\n")[0] if b"\r\n0\r\n" in body else body
        containers = json.loads(clean_json)

        # 1. Match por labels de compose/swarm do projeto nexus/chat
        for c in containers:
            labels = c.get("Labels", {})
            proj = (labels.get("com.docker.compose.project") or labels.get("com.docker.stack.namespace") or "").lower()
            svc = (labels.get("com.docker.compose.service") or labels.get("com.docker.swarm.service.name") or "").lower()
            if ("nexus" in proj or "chat" in proj) and (svc == service_name or service_name in svc):
                matched_id = c["Id"]
                _CONTAINER_CACHE[service_name] = {"id": matched_id, "timestamp": now}
                return matched_id

        # 2. Match por nomes de container (ex: nexus_chat_backend, stack_nexus-chat-backend.1.xxx)
        for c in containers:
            for name in c.get("Names", []):
                clean_name = name.lstrip("/").lower()
                if ("nexus" in clean_name or "chat" in clean_name) and service_name in clean_name:
                    matched_id = c["Id"]
                    _CONTAINER_CACHE[service_name] = {"id": matched_id, "timestamp": now}
                    return matched_id

        # 3. Match amplo por sufixo de serviço
        for c in containers:
            for name in c.get("Names", []):
                clean_name = name.lstrip("/").lower()
                if clean_name.endswith(f"_{service_name}") or clean_name.endswith(f"-{service_name}") or f"_{service_name}." in clean_name:
                    matched_id = c["Id"]
                    _CONTAINER_CACHE[service_name] = {"id": matched_id, "timestamp": now}
                    return matched_id

    except Exception as e:
        logger.warning(f"Erro na descoberta dinâmica do container {service_name}: {e}")

    return None

# 1. Regex para timestamp oficial do Docker no início da linha: 2026-09-29T18:04:29.123456789Z
DOCKER_TS_RE = re.compile(r'^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)\s*')
# 2. Regex para Nginx: [29/Sep/2026:17:59:35 +0000]
NGINX_DATE_RE = re.compile(r'\[(\d{2})/([A-Za-z]{3})/(\d{4}):(\d{2}):(\d{2}):(\d{2})\s*([+-]\d{4})?\]')
# 3. Regex para ISO 8601 avulso: 2026-09-29T17:59:35.123456Z ou 2026-09-29T17:59:35Z
ISO_DATE_RE = re.compile(r'(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?)(?:Z|([+-]\d{2}:?\d{2}))?')

MONTH_MAP = {
    "Jan": 1, "Feb": 2, "Mar": 3, "Apr": 4, "May": 5, "Jun": 6,
    "Jul": 7, "Aug": 8, "Sep": 9, "Oct": 10, "Nov": 11, "Dec": 12
}

def format_to_brasilia_time(line: str) -> str:
    """Converte datas/horas encontradas na linha de log para o Horário de Brasília (America/Sao_Paulo)."""
    # 1. Tratar timestamp do Docker no início da linha (ex: 2026-09-29T18:04:29.123456789Z)
    docker_match = DOCKER_TS_RE.match(line)
    if docker_match:
        raw_ts = docker_match.group(1)
        base_ts = raw_ts.split(".")[0] + "+00:00"
        try:
            dt = datetime.fromisoformat(base_ts)
            br_dt = dt.astimezone(BR_TIMEZONE)
            ts_str = f"[{br_dt.strftime('%d/%m/%Y %H:%M:%S')}] "
            line = ts_str + line[docker_match.end():]
        except Exception:
            pass

    # 2. Converter formato Nginx: [29/Sep/2026:17:59:35 +0000]
    def replace_nginx_date(match):
        day, mon_str, year, hour, minute, sec, tz_str = match.groups()
        mon = MONTH_MAP.get(mon_str, 1)
        try:
            # Assume UTC caso seja +0000 ou ausente
            dt = datetime(int(year), mon, int(day), int(hour), int(minute), int(sec), tzinfo=ZoneInfo("UTC"))
            br_dt = dt.astimezone(BR_TIMEZONE)
            return f"[{br_dt.strftime('%d/%m/%Y %H:%M:%S')}]"
        except Exception:
            return match.group(0)

    line = NGINX_DATE_RE.sub(replace_nginx_date, line)

    # 3. Converter formato ISO 8601 se presente
    def replace_iso_date(match):
        iso_str, tz_offset = match.groups()
        try:
            base_iso = iso_str.split(".")[0]
            dt = datetime.fromisoformat(base_iso)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=ZoneInfo("UTC"))
            br_dt = dt.astimezone(BR_TIMEZONE)
            return f"[{br_dt.strftime('%d/%m/%Y %H:%M:%S')}]"
        except Exception:
            return match.group(0)

    line = ISO_DATE_RE.sub(replace_iso_date, line)
    return line

def clean_docker_stream(body: bytes) -> List[str]:
    """Decodifica o formato de multiplexação de stream do Docker (8-byte header por frame)."""
    lines = []
    payload = body

    # Se houver cabeçalhos de chunked transfer-encoding HTTP/1.1, ignora a linha de tamanho inicial
    if b"\r\n" in payload:
        first_line, remainder = payload.split(b"\r\n", 1)
        try:
            int(first_line, 16)
            payload = remainder
        except ValueError:
            pass

    idx = 0
    total_len = len(payload)
    while idx < total_len:
        if idx + 8 > total_len:
            break
        # stream_type: 1 = stdout, 2 = stderr
        stream_type = payload[idx]
        if stream_type not in (1, 2):
            idx += 1
            continue

        size = int.from_bytes(payload[idx+4:idx+8], byteorder="big")
        idx += 8
        if size <= 0 or idx + size > total_len:
            break

        frame_bytes = payload[idx:idx+size]
        idx += size
        text = frame_bytes.decode("utf-8", errors="replace")
        for line in text.splitlines():
            cleaned = line.strip("\r\n")
            if cleaned and cleaned != "0":
                formatted = format_to_brasilia_time(cleaned)
                lines.append(formatted)
    return lines

def _query_docker_logs(target_container: str, query_str: str) -> tuple[str, bytes]:
    """Executa requisição HTTP pura no socket Unix do Docker para obter logs do container."""
    sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    sock.settimeout(5.0)
    sock.connect(DOCKER_SOCKET_PATH)

    request = (
        f"GET /containers/{target_container}/logs?{query_str} HTTP/1.1\r\n"
        f"Host: localhost\r\n"
        f"Connection: close\r\n\r\n"
    )
    sock.sendall(request.encode("utf-8"))

    response = b""
    while True:
        chunk = sock.recv(4096)
        if not chunk:
            break
        response += chunk
    sock.close()

    header_bytes, _, body_bytes = response.partition(b"\r\n\r\n")
    header_text = header_bytes.decode("utf-8", errors="ignore")
    status_line = header_text.splitlines()[0] if header_text else ""
    return status_line, body_bytes


def fetch_container_logs(
    service_name: str,
    tail: int = 100,
    target_date: str = None,
    start_time: str = None,
    end_time: str = None
) -> Dict[str, Any]:
    """Obtém as linhas de log do contêiner Docker com descoberta dinâmica e suporte a fuso de Brasília."""
    if service_name not in CONTAINER_SERVICES:
        return {
            "service": service_name,
            "container": "unknown",
            "available": False,
            "logs": [],
            "error": f"Serviço '{service_name}' inválido. Disponíveis: backend, frontend."
        }

    # Descoberta dinâmica: suporta Docker Compose local, Portainer Stacks e Swarm
    target_container = discover_container_target(service_name) or CONTAINER_SERVICES.get(service_name)

    if not os.path.exists(DOCKER_SOCKET_PATH):
        return {
            "service": service_name,
            "container": target_container,
            "available": False,
            "logs": [f"[{service_name.upper()}] Socket do Docker ({DOCKER_SOCKET_PATH}) não está acessível no container."],
            "error": "Docker socket indisponível."
        }

    try:
        query_params = ["stdout=1", "stderr=1", "timestamps=1"]

        # Se houver filtro de data específica (formato YYYY-MM-DD no Horário de Brasília)
        if target_date:
            try:
                parts = target_date.split("-")
                year, month, day = int(parts[0]), int(parts[1]), int(parts[2])

                sh, sm = 0, 0
                if start_time and ":" in start_time:
                    t_parts = start_time.split(":")
                    sh, sm = int(t_parts[0]), int(t_parts[1])

                eh, em = 23, 59
                if end_time and ":" in end_time:
                    t_parts = end_time.split(":")
                    eh, em = int(t_parts[0]), int(t_parts[1])

                dt_start = datetime(year, month, day, sh, sm, 0, tzinfo=BR_TIMEZONE)
                dt_end = datetime(year, month, day, eh, em, 59, tzinfo=BR_TIMEZONE)

                since_epoch = int(dt_start.timestamp())
                until_epoch = int(dt_end.timestamp())

                query_params.append(f"since={since_epoch}")
                query_params.append(f"until={until_epoch}")
                query_params.append(f"tail={max(tail, 500)}")
            except Exception as parse_err:
                logger.warning(f"Erro ao parsear filtro de data/hora ({target_date}, {start_time}, {end_time}): {parse_err}")
                query_params.append(f"tail={tail}")
        else:
            query_params.append(f"tail={tail}")

        query_str = "&".join(query_params)

        # 1ª tentativa com o alvo descoberto/cache
        status_line, body_bytes = _query_docker_logs(target_container, query_str)

        # Se retornar 404, força redescoberta dinâmica e tenta uma 2ª vez (auto-recuperação Portainer/Swarm)
        if "404" in status_line:
            refreshed_target = discover_container_target(service_name, force_refresh=True)
            if refreshed_target and refreshed_target != target_container:
                target_container = refreshed_target
                status_line, body_bytes = _query_docker_logs(target_container, query_str)

        if "200" not in status_line:
            logger.error(f"Erro ao consultar logs do container {target_container}: {status_line}")
            return {
                "service": service_name,
                "container": target_container,
                "available": False,
                "logs": [f"Erro da API Docker: {status_line}"],
                "error": status_line
            }

        parsed_logs = clean_docker_stream(body_bytes)
        return {
            "service": service_name,
            "container": target_container,
            "available": True,
            "logs": parsed_logs,
            "total_lines": len(parsed_logs),
            "filter": {
                "date": target_date,
                "start_time": start_time,
                "end_time": end_time
            },
            "error": None
        }
    except Exception as e:
        logger.error(f"Falha de conexão com Docker socket para logs de {target_container}: {e}")
        return {
            "service": service_name,
            "container": target_container,
            "available": False,
            "logs": [f"Erro ao obter logs: {str(e)}"],
            "error": str(e)
        }
