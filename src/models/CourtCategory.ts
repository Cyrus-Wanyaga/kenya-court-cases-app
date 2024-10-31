import { Model, DataTypes, Optional } from "sequelize";
import sequelize from "../middleware/sequelize.js";

interface CourtCategoryAttributes {
    id: number;
    category: string;
    dateCreated: Date;
    dateModified: Date;
}

interface CourtCategoryCreationAttributes extends Optional<CourtCategoryAttributes, 'id'> { }

class CourtCategory extends Model<CourtCategoryAttributes, CourtCategoryCreationAttributes> implements CourtCategoryAttributes {
    public id!: number;
    public category!: string;
    public dateCreated!: Date;
    public dateModified!: Date;

    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;
}

CourtCategory.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    category: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true
    },
    dateCreated: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'date_created'
    },
    dateModified: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'date_modified'
    }
}, {
    sequelize,
    modelName: 'CourtCategory',
    tableName: 'court_category',
    timestamps: false
});

export default CourtCategory;