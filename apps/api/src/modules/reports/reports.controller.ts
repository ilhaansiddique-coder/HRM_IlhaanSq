import { Controller, Get, Query, Req, UseGuards } from "@nestjs/common";

import { JwtGuard } from "../../common/guards/jwt.guard";
import { ReportsService } from "./reports.service";

type AuthenticatedRequest = {
  userId?: string;
  user?: {
    id?: string;
  };
};

@Controller("reports")
@UseGuards(JwtGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get("case-study-dataset")
  async getCaseStudyDataset(
    @Query("from") from: string | undefined,
    @Query("to") to: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    const userId = String(request.userId ?? request.user?.id ?? "");
    return this.reportsService.getCaseStudyDataset({ userId, from, to });
  }
}
