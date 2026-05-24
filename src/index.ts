import { app } from './app';

const port = Number(process.env.PORT ?? 3000);

app.listen(port, () => {
  // 세미나 데모에서 바로 엔드포인트를 호출할 수 있도록 실행 포트를 표시합니다.
  console.log(`AI Review Gate demo API listening on http://localhost:${port}`);
});
