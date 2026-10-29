import os
import re
import pytest
from pathlib import Path

def test_docker_compose_ports_configuration():
    """Valida se as portas configuradas no docker-compose-local.yml estao corretas."""
    base_dir = Path(__file__).resolve().parent.parent.parent
    compose_path = base_dir / "docker" / "docker-compose-local.yml"
    
    if not compose_path.exists():
        pytest.skip(f"Arquivo {compose_path} não acessível no ambiente de execução (ex: dentro do container docker)")
    
    content = compose_path.read_text(encoding="utf-8")
    
    # Valida porta do PostgreSQL (host 5731 -> container 5432)
    assert '"5731:5432"' in content, "A porta do PostgreSQL deve ser mapeada para 5731:5432"
    
    # Valida porta do Backend (host 8035 -> container 8000)
    assert '"8035:8000"' in content, "A porta do Backend deve ser mapeada para 8035:8000"
    
    # Valida porta do Frontend (host 3005 -> container 80)
    assert '"3005:80"' in content, "A porta do Frontend deve ser mapeada para 3005:80"

def test_readme_ports_documentation():
    """Valida se o README documenta as portas atualizadas do sistema."""
    base_dir = Path(__file__).resolve().parent.parent.parent
    readme_path = base_dir / "README.md"
    
    if not readme_path.exists():
        pytest.skip(f"Arquivo {readme_path} não acessível no ambiente de execução (ex: dentro do container docker)")
    
    content = readme_path.read_text(encoding="utf-8")
    
    assert "http://localhost:3005" in content, "README deve indicar o frontend na porta 3005"
    assert "http://localhost:8035" in content, "README deve indicar a API do backend na porta 8035"
    assert "http://localhost:8035/docs" in content, "README deve indicar o Swagger na porta 8035"
    assert "localhost:5731" in content, "README deve indicar o banco PostgreSQL na porta 5731"

