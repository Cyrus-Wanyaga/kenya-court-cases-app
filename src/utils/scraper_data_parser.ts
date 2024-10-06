import { County, Court, Case, Judge, CaseJudge, Advocate, CaseAdvocate } from "../models/index.js";
import sequelize from "../middleware/sequelize.js";
import { Op } from "sequelize";

let courtName: any;
let type: any;
let county: any;
let specialCourt: boolean;

const regex = /\b(?:\d+(?:st|nd|rd|th)(?:\s+to\s+\d+(?:st|nd|rd|th))?(?:,?\s+and\s+\d+(?:st|nd|rd|th)(?:\s+to\s+\d+(?:st|nd|rd|th))?)?\s+Respondents?)\b/gi;

const parseCourtStringToSensibleData = (court: string): void => {
    courtName = court;
    if (courtName.indexOf("[") !== -1) {
        courtName = courtName.substring(0, court.indexOf("["));
    }

    if (courtName.indexOf("(") !== -1) {
        courtName = courtName.substring(0, courtName.indexOf("("));
    }

    if (courtName.includes(" at ")) {
        type = courtName.split(" at ")[0];
        county = courtName.split(" at ")[1];
        specialCourt = false;
    } else {
        console.log(`A special court type`);
        type = courtName;
        specialCourt = true;
        county = "";
    }
}

export const createCourts = async (courts: any): Promise<boolean> => {
    let returnVal: boolean = false;
    if (courts) {
        let transaction = await sequelize.transaction();

        for (const court of courts.courts) {
            parseCourtStringToSensibleData(court);

            const existingCounty = await County.findOne(
                {
                    where: {
                        county: county
                    }
                }
            );

            let courtCreateResult = undefined;
            let existingCourt;
            let created;

            if (!specialCourt && existingCounty !== null && existingCounty !== undefined && existingCounty.get('id') !== undefined) {
                const courtCreateObj = async () => {
                    if (courtName && courtName !== "") {
                        const [courtInstance, wasCreated] = await Court.findOrCreate({
                            where: { courtName },
                            defaults: {
                                courtName,
                                type,
                                countyId: existingCounty?.get('id') || 0,
                                dateCreated: new Date(),
                                dateModified: new Date()
                            },
                            transaction: transaction
                        });

                        let courtCreateObj = {
                            existingCourt: {} as Court,
                            created: false as boolean
                        };

                        courtCreateObj.existingCourt = courtInstance;
                        courtCreateObj.created = wasCreated;

                        return courtCreateObj;
                    } else {
                        return undefined;
                    }
                }

                courtCreateResult = await courtCreateObj();

                if (courtCreateResult) {
                    existingCourt = courtCreateResult.existingCourt;
                    created = courtCreateResult.created;
                } else {
                    returnVal = false;
                    break;
                }

                if (created && existingCourt) {
                    console.log(`Court ${courtName} created with ID : ${existingCourt.get('id')}`);
                } else {
                    console.log(`Court ${courtName} already exists with ID : ${existingCourt.get('id')}`);
                }

                returnVal = true;
            } else if (specialCourt) {
                console.log(`Creating a special court type`);

                const findOrCreateSpecialCourt = async () => {
                    if (courtName && courtName !== "") {
                        const [courtInstance, wasCreated] = await Court.findOrCreate({
                            where: { courtName },
                            defaults: {
                                courtName,
                                type,
                                countyId: 0,
                                dateCreated: new Date(),
                                dateModified: new Date()
                            },
                            transaction: transaction
                        });

                        let courtCreateObj = {
                            existingCourt: {} as Court,
                            created: false as boolean
                        };

                        courtCreateObj.existingCourt = courtInstance;
                        courtCreateObj.created = wasCreated;

                        return courtCreateObj;
                    } else {
                        return undefined;
                    }
                };

                courtCreateResult = await findOrCreateSpecialCourt();

                if (courtCreateResult) {
                    existingCourt = courtCreateResult.existingCourt;
                    created = courtCreateResult.created;

                    if (created) {
                        console.log(`Special court ${courtName} created with ID : ${existingCourt?.get('id')}`);
                    } else {
                        console.log(`Special court ${courtName} already exists with ID : ${existingCourt?.get('id')}`);
                    }

                    returnVal = true;
                } else {
                    returnVal = false;
                    break;
                }
            }
        }

        if (returnVal) {
            await transaction.commit();
        } else {
            await transaction.rollback();
        }
    }

    return returnVal;
}

export const createCounties = async (courts: any): Promise<boolean> => {
    if (courts) {
        console.log(`Counties : ${JSON.stringify(courts)}`);
        const transaction = await sequelize.transaction();
        let returnVal: boolean = false;

        for (const court of courts.courts) {
            console.log(`Creating county : ${court}`);
            try {
                parseCourtStringToSensibleData(court);

                const countyCreatedObj = async () => {
                    if (county && county !== "") {
                        const [countyInstance, wasCreated] = await County.findOrCreate({
                            where: { county },
                            defaults: {
                                county,
                                dateCreated: new Date(),
                                dateModified: new Date(),
                            },
                            transaction: transaction
                        });

                        console.log(`Checked if county ${county} exists or doesn't`);
                        let countyCreatedObj = {
                            existingCounty: {} as County,
                            created: false as boolean
                        };

                        countyCreatedObj.existingCounty = countyInstance;
                        countyCreatedObj.created = wasCreated;
                        return countyCreatedObj;
                    } else {
                        return undefined;
                    }
                }

                let countyCreateObj = undefined;
                if (!specialCourt) {
                    countyCreateObj = await countyCreatedObj();
                }

                let existingCounty = {} as any;
                let created = false as boolean;

                if (!specialCourt && countyCreateObj) {
                    existingCounty = countyCreateObj.existingCounty;
                    created = countyCreateObj.created;

                    if (created && existingCounty && existingCounty.get('id') !== undefined) {
                        console.log(`County ${county} created with ID : ${existingCounty.get('id')}`);
                    } else if (!created && existingCounty && existingCounty.get('id') !== undefined) {
                        console.log(`County ${county} already exists with ID : ${existingCounty.get('id')}`);
                    } else {
                        console.log(`Error: County ${county} not found or created.`);
                    }
                }

                returnVal = true;
            } catch (error) {
                console.log(`Failed to find or create court : ${court}`);
                await transaction.rollback();
                return false;
            }
        }

        if (returnVal) {
            console.log(`Committing successful transaction`);
            await transaction.commit();
        } else {
            await transaction.rollback();
        }

        return returnVal;
    } else {
        return false;
    }
}

export const createCases = async (caseHeaderAndValueObjects: any) => {
    const getCaseMetaData = async () => {
        let title = "", caseNumber = "", parties = "", caseClass = "", caseAction = "", citation = "", judges = "", advocates = "";
        let court = 0;
        let dateDelivered = undefined;

        for (const headerAndValueObj of caseHeaderAndValueObjects) {
            let rowHeader = headerAndValueObj.header?.trim();
            let rowValue = headerAndValueObj.value?.trim();

            if (rowHeader && rowHeader !== "") {
                if (rowHeader.includes(":")) {
                    rowHeader = rowHeader.replaceAll(":", "");
                }

                rowValue = rowValue ? rowValue.trim() : "";

                // console.log("At header : ", rowHeader, " with value : ", rowValue);
                switch (rowHeader.toLowerCase()) {
                    case "case number": {
                        caseNumber = rowValue;
                        break;
                    }
                    case "parties": {
                        parties = rowValue;
                        break;
                    }
                    case "date delivered": {
                        let date_delivered = new Date();
                        let date = rowValue ? parseInt(rowValue.split(" ")[0]) : 0;
                        date_delivered.setDate(date);
                        date_delivered.setMonth(6);
                        date_delivered.setFullYear(rowValue ? parseInt(rowValue.split(" ")[2]) : 0);
                        dateDelivered = date_delivered;
                        break;
                    }
                    case "case class": {
                        caseClass = rowValue || "";
                        break;
                    }
                    case "court": {
                        async function getCourtId() {
                            const court = await Court.findOne({
                                where: {
                                    courtName: rowValue || ""
                                }
                            });
                            if (court) {
                                return court.get('id');
                            } else {
                                return 0;
                            }
                        };
                        court = await getCourtId();
                        break;
                    }
                    case "case action": {
                        caseAction = rowValue;
                        break;
                    }
                    case "citation": {
                        citation = rowValue;
                        title = rowValue;
                        break;
                    }
                    case "judge(s)": {
                        judges = rowValue;
                        break;
                    }
                    case "advocates": {
                        advocates = rowValue;
                        break;
                    }
                    default:
                        break;
                }
            }
        }

        return {
            title: title,
            caseNumber: caseNumber,
            parties: parties,
            dateDelivered: dateDelivered,
            caseClass: caseClass,
            citation: citation,
            caseAction: caseAction,
            court: court,
            judges: judges,
            advocates: advocates
        }
    }

    let caseMetaData_ = await getCaseMetaData() as any;
    if (caseMetaData_) {
        try {
            console.log(`Case meta data was returned`);
            let judgeIds: number[] = [];
            let advocateIds: number[] = [];

            if (caseMetaData_.judges) {
                console.log('There are case meta data judges');
                let judges: string = "";
                judges = caseMetaData_.judges;

                const createJudge = async (judgeName: string): Promise<{ judgeObj: Judge, created: boolean, id: number }> => {
                    const sanitizedName = judgeName.trim().replace(/\s+/g, ' ').normalize('NFC');
                    console.log(`Attempting to create judge ${sanitizedName}`);

                    let judgeInstance = await Judge.findOne({ where: { name: sanitizedName } });

                    if (!judgeInstance) {
                        console.log(`Judge does not exist ... creating`);
                        judgeInstance = await Judge.create({
                            name: sanitizedName,
                            dateCreated: new Date(),
                            dateModified: new Date()
                        });

                        console.log(`The object :: ${JSON.stringify(judgeInstance)}`);

                        console.log(`Created judge with id : ${judgeInstance.get('id')}`);
                        return { judgeObj: judgeInstance, created: true, id: judgeInstance.get('id') };
                    } else {
                        return { judgeObj: judgeInstance, created: false, id: judgeInstance.get('id') };
                    }
                };

                if (judges.includes(",")) {
                    let judgeNames = judges.split(",");

                    console.log(`They are ${judgeNames.length} judges`);

                    for (const judgeName of judgeNames) {
                        try {
                            const judgeCreated: any = await createJudge(judgeName);

                            if (!judgeCreated.created && (!judgeCreated.judgeObj || judgeCreated.judgeObj === null || judgeCreated.judgeObj === undefined)) {
                                console.log(`Failed to create judge ${judgeName}`);
                                continue;
                            } else {
                                if (judgeCreated.judgeObj && judgeCreated.created) {
                                    console.log(`-------------------`);
                                    console.log(JSON.stringify(judgeCreated));
                                    console.log(`Created judge ${judgeCreated.judgeObj.get('name')} successfully with id ${judgeCreated.id}`);
                                    judgeIds.push(judgeCreated.id);
                                } else if (judgeCreated.judgeObj && !judgeCreated.created) {
                                    console.log(`Judge ${judgeName} already exists with id : ${judgeCreated.id}`);
                                    judgeIds.push(judgeCreated.id);
                                } else {
                                    console.log(`Error. Judge not created`);
                                }
                            }
                        } catch (err) {
                            console.error("Failed to create judge : " + err);
                        }
                    }
                } else {
                    try {
                        const judgeCreated: any = await createJudge(judges);

                        if (!judgeCreated.created && (!judgeCreated.judgeObj || judgeCreated.judgeObj === null || judgeCreated.judgeObj === undefined)) {
                            console.log(`Failed to create judge ${judges}`);
                        } else {
                            if (judgeCreated.judgeObj && judgeCreated.created) {
                                console.log(`Created judge ${judgeCreated.judgeObj.get('name')} successfully with id ${judgeCreated.id}`);
                                judgeIds.push(judgeCreated.id);
                            } else if (judgeCreated.judgeObj && !judgeCreated.created) {
                                console.log(`Judge ${judges} already exists with id : ${judgeCreated.id}`);
                                judgeIds.push(judgeCreated.id);
                            } else {
                                console.log(`Error. Judge was not created`);
                            }
                        }
                    } catch (err) {
                        console.error("Failed to create judge : " + err);
                    }
                }
            }

            console.log("-----------------------------------------------------");
            console.log(JSON.stringify(judgeIds));
            console.log("-----------------------------------------------------");

            if (caseMetaData_.advocates) {
                console.log(`There are case meta data advocates`);
                let advocates: string = "";
                advocates = caseMetaData_.advocates;

                const createAdvocate = async (advocateName: string): Promise<{ advocateObj: Advocate, created: boolean, id: number }> => {
                    const sanitizedName = advocateName.trim().replace(/\s+/g, ' ').normalize('NFC');
                    console.log(`Attempting to create advocate ${sanitizedName}`);

                    let advocateInstance = await Advocate.findOne({ where: { name: sanitizedName } });

                    if (!advocateInstance) {
                        console.log(`Advocate does not exist ... creating`);
                        advocateInstance = await Advocate.create({
                            name: sanitizedName,
                            dateCreated: new Date(),
                            dateModified: new Date()
                        });

                        console.log(`The object :: ${JSON.stringify(advocateInstance)}`);

                        console.log(`Created advocate with id : ${advocateInstance.get('id')}`);
                        return { advocateObj: advocateInstance, created: true, id: advocateInstance.get('id') };
                    } else {
                        return { advocateObj: advocateInstance, created: false, id: advocateInstance.get('id') };
                    }
                };

                let advocateNames: string[] = [];
                let advocateWithoutRedundantData = advocates.replace(/\([\w\s&]*\)[\w\s]*/g, "");
                advocateWithoutRedundantData = advocateWithoutRedundantData.replace(/holding brief/g, "");

                if (advocateWithoutRedundantData.includes(",")) {
                    let advocateNamesArray = advocateWithoutRedundantData.split(",");

                    for (let advocateName of advocateNamesArray) {
                        advocateName = advocateName.replace(/h\/b/g, "");
                        advocateName = advocateName.replaceAll(/for[\w\W\s\(\)&]*/g, "");
                        if (advocateName.includes(" & ")) {
                            let moreAdvocateNamesArray = advocateName.split(" & ");
                            for (const moreAdvocateName of moreAdvocateNamesArray) {
                                if (moreAdvocateName.toLowerCase().includes("no appearance")) {
                                    continue;
                                } else if (moreAdvocateName.toLowerCase().includes("advocate")) {
                                    continue;
                                } else {
                                    advocateNames.push(moreAdvocateName.trim());
                                }
                            }
                        } else {
                            if (advocateName.toLowerCase().includes("no appearance")) {
                                continue;
                            } else if (advocateName.toLowerCase().includes("advocate")) {
                                continue;
                            } else {
                                advocateNames.push(advocateName.trim());
                            }
                        }
                    }

                    for (let advocateName of advocateNames) {
                        try {
                            const advocateCreated: any = await createAdvocate(advocateName);

                            if (!advocateCreated.created && (!advocateCreated.advocateObj || advocateCreated.advocateObj === null || advocateCreated.advocateObj === undefined)) {
                                console.log(`Failed to create advocate ${advocateName}`);
                                continue;
                            } else {
                                if (advocateCreated.advocateObj && advocateCreated.created) {
                                    console.log(`Created advocate ${advocateCreated.advocateObj.get('name')} successfully`);
                                    advocateIds.push(advocateCreated.id);
                                } else if (advocateCreated.judgeObj && !advocateCreated.created) {
                                    console.log(`Advocate ${advocateCreated} already exists with id : ${advocateCreated.id}`);
                                    advocateIds.push(advocateCreated.id);
                                } else {
                                    console.log(`Error. Advocate not created`);
                                }
                            }
                        } catch (err) {
                            console.error(`Failed to create advocate completely : ${err}`);
                        }
                    }
                } else {
                    // let name = advocates.includes(" for ") ? advocates.split(" for ")[0] : advocates;
                    advocateWithoutRedundantData = advocateWithoutRedundantData.replace(/h\/b/g, "");
                    advocateWithoutRedundantData = advocateWithoutRedundantData.replaceAll(/for[\w\W\s\(\)&]*/g, "");
                    try {
                        const advocateCreated: any = await createAdvocate(advocateWithoutRedundantData);

                        if (!advocateCreated.created) {
                            console.log(`Failed to create advocate ${advocateWithoutRedundantData}`);
                        } else {
                            if (advocateCreated.advocateObj && advocateCreated.created) {
                                console.log(`Created advocate ${advocateCreated.advocateObj.get('name')} successfully`);
                                advocateIds.push(advocateCreated.id);
                            } else if (advocateCreated.judgeObj && !advocateCreated.created) {
                                console.log(`Advocate ${advocateCreated} already exists with id : ${advocateCreated.id}`);
                                advocateIds.push(advocateCreated.id);
                            } else {
                                console.log(`Error. Advocate not created`);
                            }
                        }
                    } catch (err) {
                        console.error(`Failed to create advocate completely : ${err}`);
                    }
                }

                console.log("-----------------------------------------------------");
                console.log(JSON.stringify(advocateIds));
                console.log("-----------------------------------------------------");

                let caseInstance = await Case.findOne({ where: { title: caseMetaData_.title } });
                let wasCreated;

                if (!caseInstance) {
                    console.log(`Case does not exist ... creating`);
                    caseInstance = await Case.create({
                        title: caseMetaData_.title,
                        caseNumber: caseMetaData_.caseNumber,
                        parties: caseMetaData_.parties,
                        dateDelivered: caseMetaData_.dateDelivered,
                        caseClass: caseMetaData_.caseClass,
                        courtId: caseMetaData_.court,
                        dateCreated: new Date(),
                        dateModified: new Date(),
                        citation: caseMetaData_.citation
                    });

                    console.log(`Created case with id : ${caseInstance.get('id')}`);
                }

                if (!caseInstance) {
                    wasCreated = false;
                } else {
                    wasCreated = true;
                }

                if (wasCreated) {
                    console.log(`Created case title ${caseInstance.get('title')} successfully`);
                } else {
                    console.log(`Failed to create case title ${caseInstance.get('title')}`);
                }

                if (judgeIds.length > 0 && caseInstance) {
                    for (const judgeId of judgeIds) {
                        let caseJudgeWasCreated: boolean;
                        let caseJudgeInstance: CaseJudge | null = await CaseJudge.findOne({
                            where: {
                                [Op.and]: [
                                    { judgeId: { [Op.eq]: judgeId } },
                                    { caseId: { [Op.eq]: caseInstance.get('id') } }
                                ]
                            }
                        });

                        if (!caseJudgeInstance) {
                            caseJudgeInstance = await CaseJudge.create({
                                judgeId: judgeId,
                                caseId: caseInstance.get('id')
                            });

                            caseJudgeWasCreated = true;
                            console.log(`CaseJudge record created : ${JSON.stringify(caseJudgeInstance)}`);
                        } else {
                            console.log(`CaseJudge instance already exists`);
                            caseJudgeWasCreated = false;
                            // continue;
                        }

                        if (!caseJudgeWasCreated && (!caseJudgeInstance || caseJudgeInstance === null || caseJudgeInstance === undefined)) {
                            console.log(`Failed to create case judge record`);
                        } else {
                            if (caseJudgeInstance && caseJudgeWasCreated) {
                                console.log(`Case judge instance was created successfully with id ${caseJudgeInstance.get('id')}`);
                            } else if (caseJudgeInstance && !caseJudgeWasCreated) {
                                console.log(`Case judge record was already existant with id ${caseJudgeInstance.get('id')}`);
                            } else {
                                console.log(`Error. Case judge record not created.`);
                            }
                        }
                    }
                }

                if (advocateIds.length > 0 && caseInstance) {
                    for (const advocateId of advocateIds) {
                        let caseAdvocateWasCreated: boolean;
                        let caseAdvocateInstance: CaseAdvocate | null = await CaseAdvocate.findOne({
                            where: {
                                [Op.and]: [
                                    { advocateId: { [Op.eq]: advocateId } },
                                    { caseId: { [Op.eq]: caseInstance.get('id') } }
                                ]
                            }
                        });

                        if (!caseAdvocateInstance) {
                            caseAdvocateInstance = await CaseAdvocate.create({
                                advocateId: advocateId,
                                caseId: caseInstance.get('id')
                            });

                            caseAdvocateWasCreated = true;
                            console.log(`CaseAdvocate record created : ${JSON.stringify(caseAdvocateInstance)}`);
                        } else {
                            console.log(`CaseJudge instance already exists`);
                            caseAdvocateWasCreated = false;
                        }

                        if (!caseAdvocateWasCreated && (!caseAdvocateInstance || caseAdvocateInstance === null || caseAdvocateInstance === undefined)) {
                            console.log(`Failed to create case advocate record`);
                        } else {
                            if (caseAdvocateInstance && caseAdvocateWasCreated) {
                                console.log(`Case advocate instance was created successfully`);
                            } else if (caseAdvocateInstance && !caseAdvocateWasCreated) {
                                console.log(`Case advocate record was alreay existant with id ${caseAdvocateInstance.get('id')}`);
                            } else {
                                console.log(`Error. Case advocate record not created.`);
                            }
                        }
                    }
                }
            }
        } catch (err) {
            console.log(`An error occurred : ${err}`);
        }
    }
}