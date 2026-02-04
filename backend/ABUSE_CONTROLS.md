Basic abuse controls

File upload limit
1) Oversized upload (expect 413)
```bash
curl -X POST "${BACKEND_URL:-http://localhost:8000}/documents/upload" \
  -H "Authorization: Bearer $SUPABASE_JWT" \
  -F "file=@/path/to/large-file.pdf"
```

Document quota
1) After reaching the document cap (expect 429)
```bash
curl -X POST "${BACKEND_URL:-http://localhost:8000}/documents/upload" \
  -H "Authorization: Bearer $SUPABASE_JWT" \
  -F "file=@/path/to/small-file.pdf"
```

Daily quiz session quota
1) After reaching the daily limit (expect 429)
```bash
curl -X POST "${BACKEND_URL:-http://localhost:8000}/quiz/sessions/" \
  -H "Authorization: Bearer $SUPABASE_JWT" \
  -H "Content-Type: application/json" \
  -d '{"document_id":"DOC_ID","num_questions":5,"difficulty":"easy","question_types":["mcq"]}'
```

Rate limiting (quiz endpoints)
1) Burst requests (expect 429)
```bash
for i in $(seq 1 100); do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -H "Authorization: Bearer $SUPABASE_JWT" \
    "${BACKEND_URL:-http://localhost:8000}/quiz/sessions/SESSION_ID/current"
done
```
