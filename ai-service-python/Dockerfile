FROM docker.m.daocloud.io/library/python:3.11-slim
WORKDIR /app

# Wave D1.5: sentence-transformers + torch；lifespan 预热 BAAI/bge-reranker-base（~1.1GB，可 HF_HOME 预缓存）
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple

COPY app ./app

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]