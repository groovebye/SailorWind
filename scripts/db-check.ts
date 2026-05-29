import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL!) });

(async () => {
  const areas = await prisma.portArea.count();
  const marinas = await prisma.marinaOption.count();
  const ports = await prisma.port.count();
  console.log(JSON.stringify({ portAreas: areas, marinaOptions: marinas, ports }));

  const areaList = await prisma.portArea.findMany({ select: { slug: true, name: true, lat: true, lon: true } });
  console.log("PORT_AREAS:", JSON.stringify(areaList));

  const portList = await prisma.port.findMany({
    select: { slug: true, name: true, coastlineNm: true }, orderBy: { coastlineNm: "asc" },
  });
  console.log("PORTS:", JSON.stringify(portList));
})().catch((e) => { console.error("DB ERROR:", e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
