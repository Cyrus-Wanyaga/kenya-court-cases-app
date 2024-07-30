import { County, Court, Case, Judge, CaseJudge, Advocate, CaseAdvocate } from "../models/index.js";
import sequelize from "../middleware/sequelize.js";
import { Op } from "sequelize";

let courtName: any;
let type: any;
let county: any;
let specialCourt: boolean;

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
                    case "case number":
                        caseNumber = rowValue;
                        break;
                    case "parties":
                        parties = rowValue;
                        break;
                    case "date delivered":
                        let date_delivered = new Date();
                        let date = rowValue ? parseInt(rowValue.split(" ")[0]) : 0;
                        date_delivered.setDate(date);
                        date_delivered.setMonth(6);
                        date_delivered.setFullYear(rowValue ? parseInt(rowValue.split(" ")[2]) : 0);
                        dateDelivered = date_delivered;
                        break;
                    case "case class":
                        caseClass = rowValue ? rowValue : "";
                        break;
                    case "court":
                        async function getCourtId() {
                            const court = await Court.findOne({
                                where: {
                                    courtName: rowValue ? rowValue : ""
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
                    case "case action":
                        caseAction = rowValue;
                        break;
                    case "citation":
                        citation = rowValue;
                        title = rowValue;
                        break;
                    case "judge(s)":
                        judges = rowValue;
                        break;
                    case "advocates":
                        advocates = rowValue;
                        break;
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
            court: court,
            judges: judges,
            advocates: advocates
        }
    }

    let caseMetaData_ = await getCaseMetaData() as any;
    try {
        if (caseMetaData_) {
            console.log(`Case meta data was returned`);
            // console.log(JSON.stringify(caseMetaData_));
            let caseNumber;
            if (caseMetaData_.caseNumber) {
                caseNumber = caseMetaData_.caseNumber;
            }

            let courtName = "";
            if (caseMetaData_.court) {
                courtName = caseMetaData_.court;
            }

            let judgeIds: number[] = [];
            let advocateIds: number[] = [];

            if (caseMetaData_.judges) {
                let judges: string = "";
                judges = caseMetaData_.judges;

                const createJudge = async (judgeName: string) => {
                    let judgeObj: Judge;
                    let created: boolean;

                    const [judgeInstance, judgeCreated] = await Judge.findOrCreate({
                        where: { name: judgeName.trim() },
                        defaults: {
                            name: judgeName,
                            dateCreated: new Date(),
                            dateModified: new Date()
                        }
                    });

                    judgeObj = judgeInstance;
                    created = judgeCreated;

                    return {
                        judgeObj: judgeObj,
                        created: created
                    }
                };

                if (judges.includes(",")) {
                    let judgeNames = judges.split(",");

                    for (const judgeName of judgeNames) {
                        const judgeCreated: any = await createJudge(judgeName);

                        if (!judgeCreated.created) {
                            console.log(`Failed to create judge ${judgeName}`);
                            continue;
                        } else {
                            if (judgeCreated.judgeObj && judgeCreated.created) {
                                console.log(`Created judge ${judgeCreated.judgeObj.get('name')} successfully`);
                                judgeIds.push(judgeCreated.judgeObj.get('id'));
                            } else if (judgeCreated.judgeObj && !judgeCreated.created) {
                                console.log(`Judge ${judgeName} already exists with id : ${judgeCreated.judgeObj.get('id')}`);
                                judgeIds.push(judgeCreated.judgeObj.get('id'));
                            } else {
                                console.log(`Error. Judge not created`);
                            }
                        }
                    }
                } else {
                    const judgeCreated: any = await createJudge(judges);

                    if (!judgeCreated.created) {
                        console.log(`Failed to create judge ${judges}`);
                    } else {
                        if (judgeCreated.judgeObj && judgeCreated.created) {
                            console.log(`Created judge ${judgeCreated.judgeObj.get('name')} successfully`);
                            judgeIds.push(judgeCreated.judgeObj.get('id'));
                        } else if (judgeCreated.judgeObj && !judgeCreated.created) {
                            console.log(`Judge ${judges} already exists with id : ${judgeCreated.judgeObj.get('id')}`);
                            judgeIds.push(judgeCreated.judgeObj.get('id'));
                        } else {
                            console.log(`Error. Judge not created`);
                        }
                    }
                }
            }

            if (caseMetaData_.advocates) {
                let advocates: string = "";
                advocates = caseMetaData_.advocates;

                const createAdvocate = async (advocateName: string) => {
                    let advocateObj: Advocate;
                    let created: boolean;

                    const [advocateInstance, advocateCreated] = await Advocate.findOrCreate({
                        where: { name: advocateName.trim() },
                        defaults: {
                            name: advocateName,
                            dateCreated: new Date(),
                            dateModified: new Date()
                        }
                    });

                    advocateObj = advocateInstance;
                    created = advocateCreated;

                    return {
                        advocateObj: advocateInstance,
                        created: created
                    }
                };

                let advocateNames: string[] = [];
                if (advocates.includes(",")) {
                    let advocateNamesArray = advocates.split(",");

                    for (const advocateName of advocateNamesArray) {
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

                    for (const advocateName of advocateNames) {
                        let name = advocateName.includes(" for ") ? advocateName.split(" for ")[0] : advocateName;
                        const advocateCreated: any = await createAdvocate(name);

                        if (!advocateCreated.created) {
                            console.log(`Failed to create advocate ${name}`);
                            continue;
                        } else {
                            if (advocateCreated.advocateObj && advocateCreated.created) {
                                console.log(`Created advocate ${advocateCreated.advocateObj.get('name')} successfully`);
                                advocateIds.push(advocateCreated.advocateObj.get('id'));
                            } else if (advocateCreated.judgeObj && !advocateCreated.created) {
                                console.log(`Advocate ${advocateCreated} already exists with id : ${advocateCreated.advocateObj.get('id')}`);
                                advocateIds.push(advocateCreated.advocateObj.get('id'));
                            } else {
                                console.log(`Error. Advocate not created`);
                            }
                        }
                    }
                } else {
                    let name = advocates.includes(" for ") ? advocates.split(" for ")[0] : advocates;
                    const advocateCreated: any = await createAdvocate(name);

                    if (!advocateCreated.created) {
                        console.log(`Failed to create advocate ${name}`);
                    } else {
                        if (advocateCreated.advocateObj && advocateCreated.created) {
                            console.log(`Created advocate ${advocateCreated.advocateObj.get('name')} successfully`);
                            advocateIds.push(advocateCreated.advocateObj.get('id'));
                        } else if (advocateCreated.judgeObj && !advocateCreated.created) {
                            console.log(`Advocate ${advocateCreated} already exists with id : ${advocateCreated.advocateObj.get('id')}`);
                            advocateIds.push(advocateCreated.advocateObj.get('id'));
                        } else {
                            console.log(`Error. Advocate not created`);
                        }
                    }
                }
            }

            const [caseInstance, wasCreated] = await Case.findOrCreate({
                where: { caseNumber },
                defaults: {
                    title: caseMetaData_.title,
                    caseNumber: caseMetaData_.caseNumber,
                    parties: caseMetaData_.parties,
                    dateDelivered: caseMetaData_.dateDelivered,
                    caseClass: caseMetaData_.caseClass,
                    courtId: caseMetaData_.court,
                    dateCreated: new Date(),
                    dateModified: new Date(),
                    citation: caseMetaData_.citation
                }
            });

            if (wasCreated) {
                console.log(`Created case title ${caseInstance.get('title')} successfully`);
            } else {
                console.log(`Failed to create case title ${caseInstance.get('title')}`);
            }

            if (judgeIds.length > 0 && caseInstance) {
                for (const judgeId of judgeIds) {
                    const [caseJudgeInstance, caseJudgeWasCreated] = await CaseJudge.findOrCreate({
                        where: {
                            [Op.and]: [
                                { judgeId: { [Op.eq]: judgeId } },
                                { caseId: { [Op.eq]: caseInstance.get('id') } }
                            ]
                        },
                        defaults: {
                            judgeId: judgeId,
                            caseId: caseInstance.get('id')
                        }
                    });

                    if (!caseJudgeWasCreated) {
                        console.log(`Failed to create case judge record`);
                    } else {
                        if (caseJudgeInstance && caseJudgeWasCreated) {
                            console.log(`Case judge instance was created successfully`);
                        } else if (caseJudgeInstance && !caseJudgeWasCreated) {
                            console.log(`Case judge record was alreay existant with id ${caseJudgeInstance.get('id')}`);
                        } else {
                            console.log(`Error. Case judge record not created.`);
                        }
                    }
                }
            }

            if (advocateIds.length > 0 && caseInstance) {
                for (const advocateId of advocateIds) {
                    const [caseAdvocateInstance, caseAdvocateWasCreated] = await CaseAdvocate.findOrCreate({
                        where: {
                            [Op.and]: [
                                { advocateId: { [Op.eq]: advocateId } },
                                { caseId: { [Op.eq]: caseInstance.get('id') } }
                            ]
                        },
                        defaults: {
                            advocateId: advocateId,
                            caseId: caseInstance.get('id')
                        }
                    });

                    if (!caseAdvocateWasCreated) {
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
