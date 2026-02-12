import React from "react";
import { useState, useEffect, useCallback } from "react";
import "./App.css";
import mondaySdk from "monday-sdk-js";
import "@vibe/core/tokens";
//Explore more Monday React Components here: https://vibe.monday.com/
import { Heading, Text, Loader, Box, Flex, TextField, IconButton, Button, TextArea, Dropdown } from "@vibe/core";
import { Settings } from "@vibe/icons";

// Usage of mondaySDK example, for more information visit here: https://developer.monday.com/apps/docs/introduction-to-the-sdk/
const monday = mondaySdk();

const App = () => {
    console.log("App start");
    // ============================================
    // STATE MANAGEMENT
    // ============================================
    const [context, setContext] = useState(); // Board context from monday
    const [boardId, setBoardId] = useState(null); // Current board ID
    const [columns, setColumns] = useState([]); // List of columns in current board
    const [loading, setLoading] = useState(false); // Loading state for columns
    const [hoveredColumnId, setHoveredColumnId] = useState(null); // Track hovered column for ID display
    const [childBoards, setChildBoards] = useState([]); // Boards that link to current board
    const [loadingChildBoards, setLoadingChildBoards] = useState(false); // Loading state for child boards
    const [hoveredChildBoardId, setHoveredChildBoardId] = useState(null); // Track hovered child board
    const [selectedSection, setSelectedSection] = useState("columns"); // Track which sidebar section is active
    const [searchColumnsQuery, setSearchColumnsQuery] = useState(""); // Search query for columns
    const [searchChildBoardsQuery, setSearchChildBoardsQuery] = useState(""); // Search query for child boards
    const [isAdmin, setIsAdmin] = useState(false); // Is current user board admin/owner
    const [showAdminPanel, setShowAdminPanel] = useState(false); // Show/hide admin customization panel
    const [formConfig, setFormConfig] = useState(null); // Form configuration (sections and fields)
    const [loadingFormConfig, setLoadingFormConfig] = useState(false); // Loading state for form config
    const [formData, setFormData] = useState({}); // Form field values being filled by user

    // ============================================
    // FETCH CHILD BOARDS FUNCTION
    // ============================================
    // Queries all boards in workspace and finds boards with connected board columns
    // that link back to the current board. Returns results as "BoardName - ColumnLabel"
    const fetchChildBoards = async (currentBoardId) => {
        setLoadingChildBoards(true);
        try {
            // First, get all boards
            const boardsQuery = `
            query {
              boards(limit: 500) {
                id
                name
                columns {
                  id
                  title
                  type
                  settings_str
                }
              }
            }
          `;

            const boardsResult = await monday.api(boardsQuery);
            const allBoards = boardsResult.data?.boards || [];
            // Find boards that have connected board columns linking to the current board
            const childBoardsList = [];

            for (const board of allBoards) {
                if (board.id === currentBoardId) continue; // Skip current board
                for (const column of board.columns || []) {
                    if (column.type === "board_relation") {
                        try {
                            const settings = JSON.parse(column.settings_str || "{}");
                            // Check if this connected board column links to our current board
                            if (settings.boardIds && settings.boardIds.includes(parseInt(currentBoardId))) {
                                childBoardsList.push({
                                    id: `${board.id}-${column.id}`,
                                    boardId: board.id,
                                    boardName: board.name,
                                    columnId: column.id,
                                    columnLabel: column.title,
                                    label: `${board.name} - ${column.title}`,
                                });
                            }
                        } catch (e) {
                            console.warn("Could not parse column settings:", e);
                        }
                    }
                }
            }

            // Sort by label alphabetically
            childBoardsList.sort((a, b) => a.label.localeCompare(b.label));
            setChildBoards(childBoardsList);
        } catch (error) {
            console.error("Error fetching child boards:", error);
        } finally {
            setLoadingChildBoards(false);
        }
    };

    // ============================================
    // FORM CONFIG FUNCTIONS
    // ============================================
    // Generate default form config from board columns (all fields in one section, sorted alphabetically)
    const generateDefaultFormConfig = useCallback((boardColumns) => {
        const sortedFields = [...boardColumns]
            .sort((a, b) => a.title.toLowerCase().localeCompare(b.title.toLowerCase()))
            .map((col) => ({
                id: col.id,
                label: col.title,
                type: mapColumnTypeToFieldType(col.type),
                required: false,
                columnId: col.id,
            }));

        return {
            sections: [
                {
                    id: "default",
                    title: "Form Fields",
                    fields: sortedFields,
                },
            ],
        };
    }, []);

    // Map monday column types to form field types
    const mapColumnTypeToFieldType = (columnType) => {
        const typeMap = {
            text: "text",
            long_text: "textarea",
            numbers: "number",
            date: "date",
            status: "select",
            dropdown: "select",
            checkbox: "checkbox",
            email: "email",
            phone: "phone",
        };
        return typeMap[columnType] || "text";
    };

    // Load form config from instance settings, fallback to default
    const loadFormConfig = async () => {
        setLoadingFormConfig(true);
        try {
            // Try to get saved config from instance settings
            const savedConfig = await monday.execute("getData", { key: "formConfig" });
            if (savedConfig && savedConfig.data && savedConfig.data.value) {
                const parsedConfig = JSON.parse(savedConfig.data.value);
                setFormConfig(parsedConfig);
            } else {
                // Use default config if no saved config exists
                if (columns.length > 0) {
                    const defaultConfig = generateDefaultFormConfig(columns);
                    setFormConfig(defaultConfig);
                }
            }
        } catch (error) {
            console.warn("Could not load form config, using default:", error);
            // Fallback to default if loading fails
            if (columns.length > 0) {
                const defaultConfig = generateDefaultFormConfig(columns);
                setFormConfig(defaultConfig);
            }
        } finally {
            setLoadingFormConfig(false);
        }
    };

    // Save form config to instance settings
    const saveFormConfig = async (configToSave) => {
        try {
            await monday.execute("setData", {
                key: "formConfig",
                value: JSON.stringify(configToSave),
            });
            console.log("Form config saved successfully");
        } catch (error) {
            console.error("Error saving form config:", error);
        }
    };

    // ============================================
    // FORM FIELD RENDERING
    // ============================================
    // Render individual form field based on type
    const renderFormField = (field) => {
        const value = formData[field.id] || "";
        const onChange = (newValue) => {
            setFormData({ ...formData, [field.id]: newValue });
        };

        switch (field.type) {
            case "textarea":
                return <TextArea key={field.id} label={field.label} value={value} onChange={onChange} placeholder={`Enter ${field.label}`} />;
            case "number":
                return <TextField key={field.id} label={field.label} type="number" value={value} onChange={onChange} placeholder={`Enter ${field.label}`} />;
            case "date":
                return <TextField key={field.id} label={field.label} type="date" value={value} onChange={onChange} />;
            case "email":
                return <TextField key={field.id} label={field.label} type="email" value={value} onChange={onChange} placeholder={`Enter ${field.label}`} />;
            case "phone":
                return <TextField key={field.id} label={field.label} type="tel" value={value} onChange={onChange} placeholder={`Enter ${field.label}`} />;
            case "checkbox":
                return (
                    <Box key={field.id} marginBottom="medium">
                        <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
                            <input
                                type="checkbox"
                                checked={value === true || value === "true"}
                                onChange={(e) => onChange(e.target.checked)}
                                style={{ marginRight: "8px" }}
                            />
                            <Text type="paragraph">{field.label}</Text>
                        </label>
                    </Box>
                );
            case "select":
                return (
                    <Dropdown
                        key={field.id}
                        label={field.label}
                        value={value}
                        onChange={onChange}
                        options={[
                            { label: "Select...", value: "" },
                            { label: "Option 1", value: "option1" },
                            { label: "Option 2", value: "option2" },
                        ]}
                    />
                );
            case "text":
            default:
                return <TextField key={field.id} label={field.label} value={value} onChange={onChange} placeholder={`Enter ${field.label}`} />;
        }
    };

    // ============================================
    // INITIALIZE APP - FETCH BOARD DATA
    // ============================================
    // Executes on component mount. Listens for board context from monday,
    // then fetches columns and child boards for the current board.
    useEffect(() => {
        // Notice this method notifies the monday platform that user gains a first value in an app.
        // Read more about it here: https://developer.monday.com/apps/docs/mondayexecute#value-created-for-user/
        monday.execute("valueCreatedForUser");

        // Listen for context changes
        monday.listen("context", async (res) => {
            setContext(res.data);

            // ============================================
            // DETECT ADMIN USER
            // ============================================
            // Check if user is board admin/owner
            // In monday context, check user permissions or board ownership
            console.log("User information ", res);
            if (res.data && res.data.user) {
                // User is considered admin if they have "owner" or "admin" role
                // For now, using a simple check - in production, query user's board permissions
                const userRole = res.data.user.role || res.data.user.account_owner;
                setIsAdmin(userRole === "owner" || userRole === "admin" || res.data.user.account_owner === true);
            }

            // Extract board ID from context
            if (res.data && res.data.boardId) {
                setBoardId(res.data.boardId);

                // Fetch columns for this board
                setLoading(true);
                try {
                    const query = `
                    query {
                      boards(ids: [${res.data.boardId}]) {
                        columns {
                          id
                          title
                          type
                        }
                      }
                    }
                  `;

                    const result = await monday.api(query);
                    if (result.data && result.data.boards && result.data.boards.length > 0) {
                        const unsortedColumns = result.data.boards[0].columns || [];

                        // Sort columns alphabetically by title, then by id if titles are the same
                        const sortedColumns = [...unsortedColumns].sort((a, b) => {
                            if (a.title.toLowerCase() === b.title.toLowerCase()) {
                                return a.id.localeCompare(b.id);
                            }
                            return a.title.toLowerCase().localeCompare(b.title.toLowerCase());
                        });

                        setColumns(sortedColumns);

                        // Load form config (either saved or default)
                        // Note: We need to use the sortedColumns here directly since state updates are async
                        const defaultConfig = generateDefaultFormConfig(sortedColumns);
                        setFormConfig(defaultConfig);

                        // Now fetch child boards (boards that reference this board via connected board columns)
                        await fetchChildBoards(res.data.boardId);
                    }
                } catch (error) {
                    console.error("Error fetching columns:", error);
                } finally {
                    setLoading(false);
                }
            }
        });
    }, [generateDefaultFormConfig]);

    // ============================================
    // HELPER FUNCTIONS - FILTERING
    // ============================================
    // Filter columns based on search query (searches title and type)
    const filteredColumns = columns.filter(
        (column) =>
            column.title.toLowerCase().includes(searchColumnsQuery.toLowerCase()) || column.type.toLowerCase().includes(searchColumnsQuery.toLowerCase()),
    );

    // Filter child boards based on search query (searches label)
    const filteredChildBoards = childBoards.filter((item) => item.label.toLowerCase().includes(searchChildBoardsQuery.toLowerCase()));

    return (
        <Box className="App" backgroundColor="var(--primary-background-color)">
            {/* HEADER - Display board info and user */}
            <Box marginBottom="large" padding="medium">
                {/* Header with title and admin gear icon */}
                <Flex align="center" justify="space-between" marginBottom="medium">
                    <Heading type="h1" weight="bold">
                        Monday Board Info
                    </Heading>
                    {/* Admin Gear Icon - Only visible to admins */}
                    {isAdmin && (
                        <IconButton
                            kind="tertiary"
                            size="large"
                            icon={Settings}
                            onClick={() => setShowAdminPanel(!showAdminPanel)}
                            title="Customize form (Admin only)"
                        />
                    )}
                </Flex>

                {context && (
                    <Box marginBottom="medium">
                        <Text type="paragraph" color="var(--primary-text-color)">
                            <strong>User ID:</strong> {context.user?.id || "Loading..."}
                        </Text>
                    </Box>
                )}

                {boardId && (
                    <Box marginBottom="medium">
                        <Text type="paragraph" color="var(--primary-text-color)">
                            <strong>Here is the board id:</strong> {boardId}
                        </Text>
                    </Box>
                )}
            </Box>

            {/* ADMIN PANEL - Shows when admin clicks gear icon */}
            {showAdminPanel && isAdmin && (
                <Box
                    padding="medium"
                    marginBottom="medium"
                    style={{ backgroundColor: "rgba(0, 115, 234, 0.1)", border: "1px solid var(--ui-border-color)", borderRadius: "8px" }}
                >
                    <Flex align="center" justify="space-between" marginBottom="medium">
                        <Heading type="h3" weight="bold">
                            Form Customization (Admin Panel)
                        </Heading>
                        <button
                            onClick={() => setShowAdminPanel(false)}
                            style={{
                                cursor: "pointer",
                                padding: "4px 12px",
                                border: "1px solid var(--ui-border-color)",
                                borderRadius: "4px",
                                backgroundColor: "transparent",
                            }}
                        >
                            Close
                        </button>
                    </Flex>
                    <Text type="paragraph" color="var(--secondary-text-color)">
                        Admin panel will appear here. You can customize the form by adding/removing fields.
                    </Text>
                </Box>
            )}

            {/* MAIN LAYOUT - Sidebar + Content Area */}
            <Flex className="metadata-layout" align="Start">
                {/* LEFT SIDEBAR - Navigation */}
                <Box className="sidebar">
                    {/* Columns Navigation Item */}
                    <div
                        className={`nav-item ${selectedSection === "columns" ? "active" : ""}`}
                        onClick={() => setSelectedSection("columns")}
                        style={{ cursor: "pointer" }}
                    >
                        <Text type="paragraph" weight="bold">
                            Board Columns
                        </Text>
                    </div>

                    {/* Child Boards Navigation Item */}
                    <div
                        className={`nav-item ${selectedSection === "childBoards" ? "active" : ""}`}
                        onClick={() => setSelectedSection("childBoards")}
                        style={{ cursor: "pointer" }}
                    >
                        <Text type="paragraph" weight="bold">
                            Child Boards
                        </Text>
                    </div>
                </Box>

                {/* RIGHT CONTENT AREA - Metadata Section */}
                <Box className="main-content metadata-section">
                    {/* COLUMNS VIEW */}
                    {selectedSection === "columns" && (
                        <Box>
                            <Heading type="h2" weight="bold" marginBottom="medium">
                                Board Columns
                            </Heading>

                            {/* Search input for columns */}
                            {columns && columns.length > 0 && (
                                <Box marginBottom="medium">
                                    <TextField
                                        placeholder="Search columns by name or type..."
                                        value={searchColumnsQuery}
                                        onChange={(value) => setSearchColumnsQuery(value)}
                                        onClear={() => setSearchColumnsQuery("")}
                                    />
                                </Box>
                            )}

                            {/* Loading state while fetching columns */}
                            {loading ? (
                                <Flex align="center" gap="small">
                                    <Loader />
                                    <Text type="paragraph" color="var(--primary-text-color)">
                                        Loading columns...
                                    </Text>
                                </Flex>
                            ) : columns && columns.length > 0 ? (
                                // Display columns in grid layout - hover to see column ID
                                <Box className="columns-container">
                                    {filteredColumns.length > 0 ? (
                                        filteredColumns.map((column) => (
                                            <div
                                                key={column.id}
                                                onMouseEnter={() => setHoveredColumnId(column.id)}
                                                onMouseLeave={() => setHoveredColumnId(null)}
                                                className="column-card"
                                            >
                                                <Box
                                                    padding="small"
                                                    backgroundColor="var(--secondary-background-color)"
                                                    border="1px solid var(--ui-border-color)"
                                                    borderRadius="var(--border-radius-small)"
                                                >
                                                    <Flex align="center" justify="space-between">
                                                        <Text type="paragraph" color="var(--primary-text-color)">
                                                            <strong>{column.title}</strong>
                                                        </Text>
                                                        {hoveredColumnId === column.id && (
                                                            <Text type="paragraph" color="var(--secondary-text-color)">
                                                                ID: {column.id}
                                                            </Text>
                                                        )}
                                                    </Flex>
                                                </Box>
                                            </div>
                                        ))
                                    ) : (
                                        <Text type="paragraph" color="var(--secondary-text-color)">
                                            No columns match your search.
                                        </Text>
                                    )}
                                </Box>
                            ) : (
                                <Text type="paragraph" color="var(--secondary-text-color)">
                                    No columns match your search.
                                </Text>
                            )}
                        </Box>

                        {/* New Section Button */}
                        <Box marginTop="medium">
                            <Button
                                kind="secondary"
                                onClick={() => {
                                    // TODO: Add new section to form
                                    console.log("New Section clicked");
                                }}
                            >
                                + New Section
                            </Button>
                        </Box>
                    ) : (
                        <Text type="paragraph" color="var(--secondary-text-color)">
                            No columns found or board not yet loaded.
                        </Text>
                    )}
                </Box>

                    {/* CHILD BOARDS VIEW */}
                    {selectedSection === "childBoards" && (
                        <Box>
                            <Heading type="h2" weight="bold" marginBottom="medium">
                                Child Boards
                            </Heading>

                            {/* Search input for child boards */}
                            {childBoards && childBoards.length > 0 && (
                                <Box marginBottom="medium">
                                    <TextField
                                        placeholder="Search child boards by label..."
                                        value={searchChildBoardsQuery}
                                        onChange={(value) => setSearchChildBoardsQuery(value)}
                                        onClear={() => setSearchChildBoardsQuery("")}
                                    />
                                </Box>
                            )}

                            {/* Loading state while fetching child boards */}
                            {loadingChildBoards ? (
                                <Flex align="center" gap="small">
                                    <Loader />
                                    <Text type="paragraph" color="var(--primary-text-color)">
                                        Loading child boards...
                                    </Text>
                                </Flex>
                            ) : childBoards && childBoards.length > 0 ? (
                                // Display child boards in grid layout - hover to see board ID
                                // Format: "BoardName - ColumnLabel"
                                <Box className="columns-container">
                                    {filteredChildBoards.length > 0 ? (
                                        filteredChildBoards.map((item) => (
                                            <div
                                                key={item.id}
                                                onMouseEnter={() => setHoveredChildBoardId(item.id)}
                                                onMouseLeave={() => setHoveredChildBoardId(null)}
                                                className="column-card"
                                            >
                                                <Box
                                                    padding="small"
                                                    backgroundColor="var(--secondary-background-color)"
                                                    border="1px solid var(--ui-border-color)"
                                                    borderRadius="var(--border-radius-small)"
                                                >
                                                    <Flex align="center" justify="space-between">
                                                        <Text type="paragraph" color="var(--primary-text-color)">
                                                            <strong>{item.label}</strong>
                                                        </Text>
                                                        {hoveredChildBoardId === item.id && (
                                                            <Text type="paragraph" color="var(--secondary-text-color)">
                                                                Board: {item.boardId}
                                                            </Text>
                                                        )}
                                                    </Flex>
                                                </Box>
                                            </div>
                                        ))
                                    ) : (
                                        <Text type="paragraph" color="var(--secondary-text-color)">
                                            No child boards match your search.
                                        </Text>
                                    )}
                                </Box>
                            ) : (
                                <Text type="paragraph" color="var(--secondary-text-color)">
                                    No child boards found.
                                </Text>
                            )}
                        </Box>
                    )}
                </Box>
            </Flex>

            {/* LAYOUT SECTION - Full width drag-and-drop form area */}
            <Box className="layout-section">
                <Box padding="medium" borderTop="1px solid var(--ui-border-color)">
                    <Heading type="h2" weight="bold" marginBottom="medium">
                        Layout
                    </Heading>

                    {loadingFormConfig ? (
                        <Flex align="center" gap="small">
                            <Loader />
                            <Text type="paragraph" color="var(--primary-text-color)">
                                Loading form...
                            </Text>
                        </Flex>
                    ) : formConfig && formConfig.sections ? (
                        <Box className="form-container">
                            {formConfig.sections.map((section) => (
                                <Box key={section.id} marginBottom="large">
                                    {/* Section title */}
                                    <Heading type="h3" weight="bold" marginBottom="medium">
                                        {section.title}
                                    </Heading>

                                    {/* Section fields in responsive grid */}
                                    <Box className="form-fields">
                                        {section.fields && section.fields.length > 0 ? (
                                            section.fields.map((field) => (
                                                <Box key={field.id} className="form-field-wrapper">
                                                    {renderFormField(field)}
                                                </Box>
                                            ))
                                        ) : (
                                            <Text type="paragraph" color="var(--secondary-text-color)">
                                                No fields in this section.
                                            </Text>
                                        )}
                                    </Box>
                                </Box>
                            ))}

                            {/* Submit button */}
                            <Flex gap="medium" marginTop="large">
                                <Button
                                    kind="primary"
                                    onClick={() => {
                                        console.log("Form submitted with data:", formData);
                                        // TODO: Implement form submission to create board item
                                    }}
                                >
                                    Submit Form
                                </Button>
                                <Button kind="secondary" onClick={() => setFormData({})}>
                                    Clear Form
                                </Button>
                            </Flex>
                        </Box>
                    ) : (
                        <Text type="paragraph" color="var(--secondary-text-color)">
                            Form could not be loaded.
                        </Text>
                    )}
                </Box>
            </Box>
        </Box>
    );
};

export default App;