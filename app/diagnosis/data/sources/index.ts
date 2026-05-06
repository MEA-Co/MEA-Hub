import type {
  AdmissionMetaKey,
  AdmissionResultRow,
  AdmissionResultSourceMap,
} from '../type';

import { ajouAceRows as AjouAceRows } from './ajou/ace';
import { ajouAdvancedConvergenceRows as AjouConvergenceRows } from './ajou/convergence';
import { ajouHighSchoolRecommendationRows as AjouRecommendRows } from './ajou/recommend';
import { catholicPotentialDocumentRows as CatholicDocumentRows } from './catholic/document';
import { catholicPotentialInterviewRows as CatholicInterviewRows } from './catholic/interview';
import { catholicRegionalBalanceRows as CatholicLocalRows } from './catholic/local';
import { cauFusionTalentRows as ChungangFusionRows } from './chungang/fusion';
import { cauGrowthTalentRows as ChungangGrowthRows } from './chungang/growth';
import { cauInvestigativeTalentRows as ChungangInquiryRows } from './chungang/inquiry';
import { cauRegionalBalanceRows as ChungangLocalRows } from './chungang/local';
import { dkuTalentDocumentRows as DankookDkuDRows } from './dankook/dku-d';
import { dkuTalentInterviewRows as DankookDkuIRows } from './dankook/dku-i';
import { dkuRegionalBalanceRows as DankookLocalRows } from './dankook/local';
import { dguDoDreamRows as DonggukDodreamRows } from './dongguk/dodream';
import { dguPrincipalRecommendationRows as DonggukRecommendRows } from './dongguk/recommend';
import { gachonKyogwaExcellenceRows as GachonExcellenceRows } from './gachon/excellence';
import { gachonWindmillRows as GachonWindRows } from './gachon/wind';
import { hansungKyogwaExcellenceRows as HansungExcellenceRows } from './hansung/excellence';
import { hansungKyogwaRegionalBalanceRows as HansungLocalRows } from './hansung/local';
import { hansungComprehensiveTalentRows as HansungTalentRows } from './hansung/talent';
import { hanyangDocumentRows as HanyangDocumentRows } from './hanyang/document';
import { hanyangInterviewRows as HanyangInterviewRows } from './hanyang/interview';
import { hanyangGeneralRecommendRows as HanyangRecommendRRows } from './hanyang/recommend-r';
import { hanyangSchoolRecommendRows as HanyangRecommendSRows } from './hanyang/recommend-s';
import { hongikSchoolLifeExcellenceRows as HongikExcellenceRows } from './hongik/excellence';
import { hongikPrincipalRecommendationRows as HongikRecommendRows } from './hongik/recommend';
import { incheonKyogwaSungjukRows as IncheonExcellenceRows } from './incheon/excellence';
import { incheonRegionalBalanceRows as IncheonLocalRows } from './incheon/local';
import { incheonKyogwaSelfRecommendRows as IncheonSelfRows } from './incheon/self';
import { inhaFutureTalentDocumentRows as InhaFutureDRows } from './inha/future-d';
import { inhaFutureTalentInterviewRows as InhaFutureIRows } from './inha/future-i';
import { inhaRegionalBalanceRows as InhaLocalRows } from './inha/local';
import { konkukKuLocalCapacity27Rows as KonkukKulocalRows } from './konkuk/kulocal';
import { konkukKuSelfRows as KonkukKuselfRows } from './konkuk/kuself';
import { kmuSchoolGradeExcellenceRows as KookminExcellenceRows } from './kookmin/excellence';
import { kmuKookminFrontierRows as KookminFrontierRows } from './kookmin/frontier';
import { koreaCategoryFitRows as KoreaCategoryRows } from './korea/category';
import { koreaSchoolRecommendRows as KoreaRecommendRows } from './korea/recommend';
import { koreaStudyRows as KoreaStudyRows } from './korea/study';
import { kwangwoonChamBitDocumentRows as KwangwoonDocumentRows } from './kwangwoon/document';
import { kwangwoonChamBitInterviewRows as KwangwoonInterviewRows } from './kwangwoon/interview';
import { kwangwoonRegionalBalanceRows as KwangwoonLocalRows } from './kwangwoon/local';
import { kwangwoonSoftwareTalentRows as KwangwoonSoftwareRows } from './kwangwoon/software';
import { kyonggiKyogwaExcellenceRows as KyonggiExcellenceRows } from './kyonggi/excellence';
import { kyonggiKguComprehensiveRows as KyonggiKguRows } from './kyonggi/KGU';
import { kyonggiPrincipalRecommendRows as KyonggiRecommendRows } from './kyonggi/recommend';
import { khuRegionalBalanceRows as KyungheeLocalRows } from './kyunghee/local';
import { khuNeoRenaissanceRows as KyungheeRenaissanceRows } from './kyunghee/renaissance';
import { myongjiTalentDocumentRows as MyongjiDocumentRows } from './myongji/document';
import { myongjiKyogwaInterviewRows as MyongjiGginterviewRows } from './myongji/gginterview';
import { myongjiTalentInterviewRows as MyongjiInterviewRows } from './myongji/interview';
import { myongjiSchoolRecommendationRows as MyongjiRecommendRows } from './myongji/recommend';
import { sahmyookPrincipalRecommendRows as SamyookRecommendRows } from './samyook/recommend';
import { sahmyookSeumTalentRows as SamyookTalentRows } from './samyook/talent';
import { sangmyungHighSchoolRecommendationRows as SangmyeongRecommendRows } from './sangmyeong/recommend';
import { sangmyungTalentRows as SangmyeongTalentRows } from './sangmyeong/talent';
import { sejongRegionalBalanceRows as SejongLocalRows } from './sejong/local';
import { sejongSejongTalentDocumentRows as SejongTalentDRows } from './sejong/talent-d';
import { sejongSejongTalentInterviewRows as SejongTalentIRows } from './sejong/talent-i';
import { snuLocalCapacity27Rows as SeoulSnulocalRows } from './seoul/snulocal';
import { snuRegularCapacity27Rows as SeoulSnunormalRows } from './seoul/snunormal';
import { sogangLocalBalanceRows as SogangLocalRows } from './sogang/local';
import { sogangGeneral1Rows as SogangNormal1Rows } from './sogang/normal_1';
import { sogangGeneral1Rows as SogangNormal2Rows } from './sogang/normal_2';
import { ssuSchoolGradeExcellenceRows as SoongsilExcellenceRows } from './soongsil/excellence';
import { ssuFutureTalentDocumentRows as SoongsilFutureDRows } from './soongsil/future-d';
import { ssuFutureTalentRows as SoongsilFutureIRows } from './soongsil/future-i';
import { skkuConvergenceTalentRows as SungkyunFusionRows } from './sungkyun/fusion';
import { skkuInquiryTalentRows as SungkyunInquiryRows } from './sungkyun/inquiry';
import { skkuSchoolRecommendRows as SungkyunRecommendRows } from './sungkyun/recommend';
import { skkuSungKyunTalentRows as SungkyunSungkyunRows } from './sungkyun/sungkyun';
import { uosRegionalBalanceRows as UosLocalRows } from './uos/local';
import { uosGeneralComprehensiveRows as UosTotal1Rows } from './uos/total_1';
import { uosGeneralTwoRows as UosTotal2Rows } from './uos/total_2';
import { yonseiActivityCapacity27Rows as YonseiActivityRows } from './yonsei/activity';
import { yonseiRecommendCapacity27Rows as YonseiRecommendRows } from './yonsei/recommend';

export const buildAdmissionMetaKey = (
  row: Pick<AdmissionResultRow, 'university' | 'admissionCategory' | 'admissionName'>,
): AdmissionMetaKey =>
  `${row.university}::${row.admissionCategory}::${row.admissionName}` as AdmissionMetaKey;

export const admissionResultSourceMap: AdmissionResultSourceMap = {
  '아주대학교::학종::ACE': AjouAceRows,
  '아주대학교::학종::첨단융합인재': AjouConvergenceRows,
  '아주대학교::교과::고교추천': AjouRecommendRows,
  '가톨릭대학교::학종::잠재능력우수자서류': CatholicDocumentRows,
  '가톨릭대학교::학종::잠재능력우수자면접': CatholicInterviewRows,
  '가톨릭대학교::교과::지역균형': CatholicLocalRows,
  '중앙대학교::학종::융합형인재': ChungangFusionRows,
  '중앙대학교::학종::성장형인재': ChungangGrowthRows,
  '중앙대학교::학종::탐구형인재': ChungangInquiryRows,
  '중앙대학교::교과::지역균형': ChungangLocalRows,
  '단국대학교::학종::DKU인재(서류형)': DankookDkuDRows,
  '단국대학교::학종::DKU인재(면접형)': DankookDkuIRows,
  '단국대학교::교과::지역균형선발': DankookLocalRows,
  '동국대학교::학종::Do Dream': DonggukDodreamRows,
  '동국대학교::교과::학교장추천인재': DonggukRecommendRows,
  '가천대학교::교과::학생부우수자': GachonExcellenceRows,
  '가천대학교::학종::가천바람개비': GachonWindRows,
  '한성대학교::교과::교과우수': HansungExcellenceRows,
  '한성대학교::교과::지역균형': HansungLocalRows,
  '한성대학교::학종::한성인재': HansungTalentRows,
  '한양대학교::학종::서류형': HanyangDocumentRows,
  '한양대학교::학종::면접형': HanyangInterviewRows,
  '한양대학교::학종::추천형': HanyangRecommendRRows,
  '한양대학교::교과::추천형': HanyangRecommendSRows,
  '홍익대학교::학종::학교생활우수자': HongikExcellenceRows,
  '홍익대학교::교과::학교장추천자': HongikRecommendRows,
  '인천대학교::교과::교과성적우수자': IncheonExcellenceRows,
  '인천대학교::교과::지역균형': IncheonLocalRows,
  '인천대학교::학종::자기추천': IncheonSelfRows,
  '인하대학교::학종::인하미래인재(서류형)': InhaFutureDRows,
  '인하대학교::학종::인하미래인재(면접형)': InhaFutureIRows,
  '인하대학교::교과::지역균형': InhaLocalRows,
  '건국대학교::교과::KU지역균형': KonkukKulocalRows,
  '건국대학교::학종::KU자기추천': KonkukKuselfRows,
  '국민대학교::교과::교과우수자': KookminExcellenceRows,
  '국민대학교::학종::국민프런티어': KookminFrontierRows,
  '고려대학교::학종::계열적합': KoreaCategoryRows,
  '고려대학교::교과::학교추천': KoreaRecommendRows,
  '고려대학교::학종::학업우수': KoreaStudyRows,
  '광운대학교::학종::광운참빛인재전형II(서류형)': KwangwoonDocumentRows,
  '광운대학교::학종::광운참빛인재전형I(면접형)': KwangwoonInterviewRows,
  '광운대학교::교과::지역균형': KwangwoonLocalRows,
  '광운대학교::학종::소프트웨어우수인재': KwangwoonSoftwareRows,
  '경기대학교::학종::KGU학생부종합': KyonggiKguRows,
  '경기대학교::교과::교과성적우수자': KyonggiExcellenceRows,
  '경기대학교::교과::학교장추천': KyonggiRecommendRows,
  '경희대학교::교과::지역균형': KyungheeLocalRows,
  '경희대학교::학종::네오르네상스': KyungheeRenaissanceRows,
  '명지대학교::학종::명지인재서류': MyongjiDocumentRows,
  '명지대학교::교과::교과면접': MyongjiGginterviewRows,
  '명지대학교::학종::명지인재면접': MyongjiInterviewRows,
  '명지대학교::교과::학교장추천': MyongjiRecommendRows,
  '상명대학교::교과::고교추천': SangmyeongRecommendRows,
  '상명대학교::학종::상명인재': SangmyeongTalentRows,
  '삼육대학교::교과::학교장추천': SamyookRecommendRows,
  '삼육대학교::학종::세움인재': SamyookTalentRows,
  '세종대학교::교과::지역균형': SejongLocalRows,
  '세종대학교::학종::세종인재(서류형)': SejongTalentDRows,
  '세종대학교::학종::세종인재(면접형)': SejongTalentIRows,
  '서울대학교::학종::지역균형': SeoulSnulocalRows,
  '서울대학교::학종::일반': SeoulSnunormalRows,
  '서강대학교::교과::지역균형': SogangLocalRows,
  '서강대학교::학종::일반 I': SogangNormal1Rows,
  '서강대학교::학종::일반 II': SogangNormal2Rows,
  '숭실대학교::교과::교과우수자': SoongsilExcellenceRows,
  '숭실대학교::학종::SSU미래인재(서류형)': SoongsilFutureDRows,
  '숭실대학교::학종::SSU미래인재(면접형)': SoongsilFutureIRows,
  '성균관대학교::학종::융합인재': SungkyunFusionRows,
  '성균관대학교::학종::탐구인재': SungkyunInquiryRows,
  '성균관대학교::교과::학교추천': SungkyunRecommendRows,
  '성균관대학교::학종::성균인재': SungkyunSungkyunRows,
  '서울시립대학교::교과::지역균형선발': UosLocalRows,
  '서울시립대학교::학종::학생부종합전형I': UosTotal1Rows,
  '서울시립대학교::학종::학생부종합전형II': UosTotal2Rows,
  '연세대학교::학종::활동우수형': YonseiActivityRows,
  '연세대학교::교과::추천형': YonseiRecommendRows,
};

export const admissionResultRows = Object.values(admissionResultSourceMap).flat();
